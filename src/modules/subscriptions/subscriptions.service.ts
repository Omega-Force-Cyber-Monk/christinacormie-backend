import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Prisma,
  SubscriptionWebhookProcessingStatus,
  VendorPlan,
  VendorSubscriptionPlatform,
  VendorSubscriptionProvider,
  VendorSubscriptionStatus,
} from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateFoundingOfferDto } from './dto/update-founding-offer.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { UpsertProviderProductDto } from './dto/upsert-provider-product.dto';

type RevenueCatWebhookPayload = {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    product_id?: string;
    entitlement_ids?: string[];
    store?: string;
    expiration_at_ms?: number | null;
    purchased_at_ms?: number | null;
  };
};

type RevenueCatEntitlement = {
  product_identifier?: string;
  expires_date?: string | null;
  purchase_date?: string | null;
  original_purchase_date?: string | null;
  store?: string;
  period_type?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
};

type RevenueCatSubscriberResponse = {
  subscriber?: {
    original_app_user_id?: string;
    management_url?: string | null;
    entitlements?: Record<string, RevenueCatEntitlement>;
    subscriptions?: Record<
      string,
      {
        expires_date?: string | null;
        purchase_date?: string | null;
        original_purchase_date?: string | null;
        store?: string;
        period_type?: string;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
      }
    >;
  };
};

const ACCESSIBLE_STATUSES = new Set<VendorSubscriptionStatus>([
  VendorSubscriptionStatus.ACTIVE,
  VendorSubscriptionStatus.TRIALING,
  VendorSubscriptionStatus.GRACE_PERIOD,
  VendorSubscriptionStatus.CANCELED,
]);

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  private readonly foundingConfigId = 'default';

  constructor(private readonly prisma: PrismaService) {}

  async listPublicPlans() {
    const [plans, foundingOffer] = await Promise.all([
      this.prisma.vendorSubscriptionPlan.findMany({
        where: { deletedAt: null, active: true },
        orderBy: [{ sortOrder: 'asc' }, { monthlyPrice: 'asc' }],
        include: { providerProducts: { where: { active: true } } },
      }),
      this.getFoundingOffer(),
    ]);

    return {
      foundingOffer: this.toFoundingOfferResponse(foundingOffer),
      items: plans.map((plan) => this.toPlanResponse(plan)),
    };
  }

  async getMySubscription(userId: string) {
    const vendor = await this.findVendorForUser(userId);
    if (!vendor) {
      throw new NotFoundException('Vendor profile not found for this account');
    }

    return this.getVendorSubscriptionResponse(vendor.id);
  }

  async syncMyRevenueCatSubscription(userId: string) {
    const vendor = await this.findVendorForUser(userId);
    if (!vendor) {
      throw new NotFoundException('Vendor profile not found for this account');
    }

    return this.syncRevenueCatSubscriber(userId, 'MANUAL_SYNC');
  }

  async handleRevenueCatWebhook(
    payload: RevenueCatWebhookPayload,
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ) {
    this.verifyRevenueCatWebhook(headers, rawBody);

    const event = payload?.event;
    if (!event) {
      throw new BadRequestException('RevenueCat webhook payload is missing event');
    }

    const appUserId = event.app_user_id;
    if (!appUserId) {
      throw new BadRequestException(
        'RevenueCat webhook event is missing app_user_id',
      );
    }

    const eventType = event.type ?? 'UNKNOWN';
    const eventId =
      event.id ??
      this.hashEventId(`${eventType}:${appUserId}:${JSON.stringify(payload)}`);

    const existing = await this.prisma.subscriptionWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existing?.status === SubscriptionWebhookProcessingStatus.PROCESSED) {
      return {
        received: true,
        duplicate: true,
        message: 'RevenueCat webhook event already processed',
      };
    }

    await this.prisma.subscriptionWebhookEvent.upsert({
      where: { eventId },
      create: {
        eventId,
        eventType,
        payload: payload as any,
        status: SubscriptionWebhookProcessingStatus.PROCESSING,
      },
      update: {
        status: SubscriptionWebhookProcessingStatus.PROCESSING,
        error: null,
      },
    });

    try {
      const result = await this.syncRevenueCatSubscriber(appUserId, eventType);

      await this.prisma.subscriptionWebhookEvent.update({
        where: { eventId },
        data: {
          vendorId: result.vendorId,
          status: SubscriptionWebhookProcessingStatus.PROCESSED,
          processedAt: new Date(),
        },
      });

      return { received: true, ...result };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'RevenueCat webhook processing failed';

      await this.prisma.subscriptionWebhookEvent.update({
        where: { eventId },
        data: {
          status: SubscriptionWebhookProcessingStatus.FAILED,
          error: message,
          processedAt: new Date(),
        },
      });

      this.logger.error(message, error instanceof Error ? error.stack : '');
      throw error;
    }
  }

  async listAdminPlans() {
    const plans = await this.prisma.vendorSubscriptionPlan.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { providerProducts: true },
    });

    return { items: plans.map((plan) => this.toPlanResponse(plan)) };
  }

  async updatePlan(planId: string, dto: UpdateSubscriptionPlanDto) {
    const plan = await this.prisma.vendorSubscriptionPlan.findFirst({
      where: { id: planId, deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (
      dto.foundingCommissionRate !== undefined &&
      dto.standardCommissionRate !== undefined &&
      dto.foundingCommissionRate > dto.standardCommissionRate
    ) {
      throw new BadRequestException(
        'Founding commission rate cannot be greater than standard commission rate',
      );
    }

    if (
      dto.foundingCommissionRate !== undefined &&
      dto.standardCommissionRate === undefined &&
      dto.foundingCommissionRate > Number(plan.standardCommissionRate)
    ) {
      throw new BadRequestException(
        'Founding commission rate cannot be greater than standard commission rate',
      );
    }

    const updated = await this.prisma.vendorSubscriptionPlan.update({
      where: { id: planId },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.monthlyPrice !== undefined
          ? { monthlyPrice: dto.monthlyPrice }
          : {}),
        ...(dto.standardCommissionRate !== undefined
          ? { standardCommissionRate: dto.standardCommissionRate }
          : {}),
        ...(dto.foundingCommissionRate !== undefined
          ? { foundingCommissionRate: dto.foundingCommissionRate }
          : {}),
        ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}),
        ...(dto.features !== undefined
          ? { features: dto.features as Prisma.InputJsonValue }
          : {}),
        ...(dto.limits !== undefined
          ? { limits: dto.limits as Prisma.InputJsonValue }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { providerProducts: true },
    });

    return this.toPlanResponse(updated);
  }

  async upsertProviderProduct(
    planId: string,
    dto: UpsertProviderProductDto,
  ) {
    const plan = await this.prisma.vendorSubscriptionPlan.findFirst({
      where: { id: planId, deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    if (!dto.productId && !dto.entitlementId && !dto.revenueCatPackageId) {
      throw new BadRequestException(
        'At least one RevenueCat product, entitlement, or package identifier is required',
      );
    }

    const existing = dto.productId
      ? await this.prisma.vendorSubscriptionProviderProduct.findUnique({
          where: {
            provider_platform_productId: {
              provider: VendorSubscriptionProvider.REVENUECAT,
              platform: dto.platform,
              productId: dto.productId,
            },
          },
        })
      : await this.prisma.vendorSubscriptionProviderProduct.findFirst({
          where: {
            planId,
            provider: VendorSubscriptionProvider.REVENUECAT,
            platform: dto.platform,
            productId: null,
          },
        });

    if (existing && existing.planId !== planId) {
      throw new ConflictException(
        'RevenueCat product is already mapped to another subscription plan',
      );
    }

    const data = {
      planId,
      provider: VendorSubscriptionProvider.REVENUECAT,
      platform: dto.platform,
      productId: dto.productId ?? null,
      entitlementId: dto.entitlementId ?? null,
      revenueCatOfferingId: dto.revenueCatOfferingId ?? null,
      revenueCatPackageId: dto.revenueCatPackageId ?? null,
      stripeProductId: dto.stripeProductId ?? null,
      stripePriceId: dto.stripePriceId ?? null,
      active: dto.active ?? true,
    };

    const product = existing
      ? await this.prisma.vendorSubscriptionProviderProduct.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.vendorSubscriptionProviderProduct.create({ data });

    return product;
  }

  async getFoundingOffer() {
    return this.prisma.vendorFoundingOfferConfig.upsert({
      where: { id: this.foundingConfigId },
      create: {
        id: this.foundingConfigId,
        active: true,
        startsAt: new Date('2026-08-05T00:00:00.000Z'),
        endsAt: new Date('2026-10-04T23:59:59.000Z'),
        discountPercent: 50,
        discountStartMonth: 4,
        discountEndMonth: 12,
        trialDays: 90,
      },
      update: {},
    });
  }

  async getFoundingOfferStatus() {
    const offer = await this.getFoundingOffer();
    return this.toFoundingOfferResponse(offer);
  }

  async updateFoundingOffer(dto: UpdateFoundingOfferDto) {
    const current = await this.getFoundingOffer();
    const startsAt = dto.startsAt ?? current.startsAt;
    const endsAt = dto.endsAt ?? current.endsAt;
    const discountStartMonth =
      dto.discountStartMonth ?? current.discountStartMonth;
    const discountEndMonth = dto.discountEndMonth ?? current.discountEndMonth;

    if (startsAt >= endsAt) {
      throw new BadRequestException(
        'Founding offer start date must be before end date',
      );
    }

    if (discountStartMonth > discountEndMonth) {
      throw new BadRequestException(
        'Founding discount start month cannot be after end month',
      );
    }

    const updated = await this.prisma.vendorFoundingOfferConfig.update({
      where: { id: this.foundingConfigId },
      data: {
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.startsAt ? { startsAt: dto.startsAt } : {}),
        ...(dto.endsAt ? { endsAt: dto.endsAt } : {}),
        ...(dto.discountPercent !== undefined
          ? { discountPercent: dto.discountPercent }
          : {}),
        ...(dto.discountStartMonth !== undefined
          ? { discountStartMonth: dto.discountStartMonth }
          : {}),
        ...(dto.discountEndMonth !== undefined
          ? { discountEndMonth: dto.discountEndMonth }
          : {}),
        ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}),
      },
    });

    return this.toFoundingOfferResponse(updated);
  }

  private async syncRevenueCatSubscriber(
    appUserId: string,
    sourceEventType: string,
  ) {
    const vendor = await this.findVendorByRevenueCatAppUserId(appUserId);
    if (!vendor) {
      throw new NotFoundException(
        'RevenueCat app_user_id does not match any vendor account',
      );
    }

    const subscriber = await this.fetchRevenueCatSubscriber(appUserId);
    const selected = await this.selectRevenueCatEntitlement(subscriber);

    if (!selected) {
      const status =
        sourceEventType.includes('REFUND') || sourceEventType.includes('REVOK')
          ? VendorSubscriptionStatus.REFUNDED
          : VendorSubscriptionStatus.EXPIRED;

      await this.expireVendorRevenueCatSubscriptions(vendor.id, status, {
        sourceEventType,
        appUserId,
        subscriber,
      });

      return this.getVendorSubscriptionResponse(vendor.id);
    }

    const { entitlementId, entitlement } = selected;
    const productId = entitlement.product_identifier;
    if (!productId) {
      throw new BadRequestException(
        'RevenueCat subscriber entitlement is missing product_identifier',
      );
    }

    const providerProduct =
      await this.prisma.vendorSubscriptionProviderProduct.findFirst({
        where: {
          provider: VendorSubscriptionProvider.REVENUECAT,
          active: true,
          OR: [
            { productId },
            { entitlementId },
            { revenueCatPackageId: productId },
          ],
        },
        include: { plan: true },
      });

    if (!providerProduct) {
      throw new NotFoundException(
        `No backend subscription plan is mapped for RevenueCat product "${productId}"`,
      );
    }

    const platform = this.mapRevenueCatStoreToPlatform(entitlement.store);
    const status = this.mapRevenueCatStatus(entitlement);
    const expiresAt = this.parseNullableDate(entitlement.expires_date);
    const purchaseDate = this.parseNullableDate(entitlement.purchase_date);
    const originalPurchaseDate = this.parseNullableDate(
      entitlement.original_purchase_date,
    );
    const foundingOffer = await this.getFoundingOffer();
    const existingFounding = await this.prisma.vendorSubscription.findFirst({
      where: { vendorId: vendor.id, isFoundingVendor: true },
      orderBy: { createdAt: 'desc' },
    });
    const isFoundingVendor =
      Boolean(existingFounding) ||
      this.isWithinFoundingWindow(vendor.createdAt, foundingOffer);
    const commissionRate = isFoundingVendor
      ? providerProduct.plan.foundingCommissionRate
      : null;

    const activeAccess = this.hasAccess(status, expiresAt);

    const result = await this.prisma.$transaction(async (tx) => {
      if (activeAccess) {
        await tx.vendorSubscription.updateMany({
          where: {
            vendorId: vendor.id,
            provider: VendorSubscriptionProvider.REVENUECAT,
            status: {
              in: [
                VendorSubscriptionStatus.ACTIVE,
                VendorSubscriptionStatus.TRIALING,
                VendorSubscriptionStatus.GRACE_PERIOD,
                VendorSubscriptionStatus.PAST_DUE,
                VendorSubscriptionStatus.CANCELED,
              ],
            },
          },
          data: {
            status: VendorSubscriptionStatus.EXPIRED,
            willRenew: false,
            rawProviderStatus: {
              reason: 'Replaced by latest RevenueCat subscription sync',
              replacedAt: new Date().toISOString(),
            },
          },
        });
      }

      const latest = await tx.vendorSubscription.findFirst({
        where: {
          vendorId: vendor.id,
          provider: VendorSubscriptionProvider.REVENUECAT,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = {
        vendorId: vendor.id,
        planId: providerProduct.planId,
        provider: VendorSubscriptionProvider.REVENUECAT,
        platform,
        status,
        isFoundingVendor,
        foundingLockedCommissionRate: commissionRate,
        startedAt: purchaseDate ?? latest?.startedAt ?? new Date(),
        trialEndsAt:
          entitlement.period_type?.toLowerCase() === 'trial'
            ? expiresAt
            : latest?.trialEndsAt ?? null,
        currentPeriodStartsAt: purchaseDate,
        currentPeriodEndsAt: expiresAt,
        willRenew: !entitlement.unsubscribe_detected_at,
        revenueCatAppUserId: appUserId,
        externalCustomerId: subscriber.subscriber?.original_app_user_id ?? null,
        externalSubscriptionId: productId,
        productId,
        entitlementId,
        latestTransactionId: productId,
        originalTransactionId: subscriber.subscriber?.original_app_user_id ?? null,
        rawProviderStatus: {
          sourceEventType,
          entitlement,
          managementUrl: subscriber.subscriber?.management_url ?? null,
        } as any,
      };

      const subscription = latest
        ? await tx.vendorSubscription.update({
            where: { id: latest.id },
            data,
          })
        : await tx.vendorSubscription.create({ data });

      await tx.vendor.update({
        where: { id: vendor.id },
        data: { selectedPlan: providerProduct.plan.code },
      });

      return subscription;
    });

    return this.getVendorSubscriptionResponse(vendor.id, result.id);
  }

  private async fetchRevenueCatSubscriber(appUserId: string) {
    const secret = process.env.REVENUECAT_SECRET_API_KEY;
    if (!secret) {
      throw new InternalServerErrorException(
        'RevenueCat secret API key is not configured',
      );
    }

    const authHeader = secret.startsWith('Bearer ')
      ? secret
      : `Bearer ${secret}`;
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(
        appUserId,
      )}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new BadRequestException(
        `RevenueCat subscriber sync failed (${response.status}). ${body || 'Please verify RevenueCat app_user_id and API key.'}`,
      );
    }

    return (await response.json()) as RevenueCatSubscriberResponse;
  }

  private async selectRevenueCatEntitlement(
    response: RevenueCatSubscriberResponse,
  ) {
    const entitlements = response.subscriber?.entitlements ?? {};
    const entries = Object.entries(entitlements);
    if (!entries.length) {
      return null;
    }

    const now = Date.now();
    const activeEntries = entries.filter(([, entitlement]) => {
      const expiresAt = this.parseNullableDate(entitlement.expires_date);
      return !expiresAt || expiresAt.getTime() > now;
    });

    const candidates = activeEntries.length ? activeEntries : entries;
    const configuredEntitlement =
      process.env.REVENUECAT_VENDOR_ENTITLEMENT_ID?.trim();

    const preferred = configuredEntitlement
      ? candidates.find(([id]) => id === configuredEntitlement)
      : null;

    const [entitlementId, entitlement] = preferred ?? candidates[0];
    return { entitlementId, entitlement };
  }

  private async expireVendorRevenueCatSubscriptions(
    vendorId: string,
    status: VendorSubscriptionStatus,
    rawProviderStatus: Record<string, unknown>,
  ) {
    const latest = await this.prisma.vendorSubscription.findFirst({
      where: {
        vendorId,
        provider: VendorSubscriptionProvider.REVENUECAT,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return;
    }

    await this.prisma.vendorSubscription.update({
      where: { id: latest.id },
      data: {
        status,
        willRenew: false,
        currentPeriodEndsAt: latest.currentPeriodEndsAt ?? new Date(),
        rawProviderStatus: rawProviderStatus as any,
      },
    });
  }

  private async getVendorSubscriptionResponse(
    vendorId: string,
    preferredSubscriptionId?: string,
  ) {
    const [vendor, freePlan, foundingOffer] = await Promise.all([
      this.prisma.vendor.findUnique({
        where: { id: vendorId },
        include: {
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
          },
        },
      }),
      this.prisma.vendorSubscriptionPlan.findUnique({
        where: { code: VendorPlan.FREE },
      }),
      this.getFoundingOffer(),
    ]);

    if (!vendor) {
      throw new NotFoundException('Vendor profile not found');
    }

    const subscription =
      (preferredSubscriptionId
        ? vendor.subscriptions.find((item) => item.id === preferredSubscriptionId)
        : null) ?? vendor.subscriptions[0];
    const plan = subscription?.plan ?? freePlan;

    if (!plan) {
      throw new InternalServerErrorException(
        'Default Free subscription plan is not configured',
      );
    }

    const expiresAt = subscription?.currentPeriodEndsAt ?? null;
    const accessActive = subscription
      ? this.hasAccess(subscription.status, expiresAt)
      : plan.code === VendorPlan.FREE;
    const isFoundingVendor =
      subscription?.isFoundingVendor ??
      this.isWithinFoundingWindow(vendor.createdAt, foundingOffer);
    const commissionRate = isFoundingVendor
      ? Number(plan.foundingCommissionRate)
      : Number(plan.standardCommissionRate);

    return {
      vendorId: vendor.id,
      plan: this.toPlanResponse(plan),
      subscription: subscription
        ? {
            id: subscription.id,
            provider: subscription.provider,
            platform: subscription.platform,
            status: subscription.status,
            accessActive,
            isFoundingVendor,
            startedAt: subscription.startedAt,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStartsAt: subscription.currentPeriodStartsAt,
            currentPeriodEndsAt: subscription.currentPeriodEndsAt,
            willRenew: subscription.willRenew,
            revenueCatAppUserId: subscription.revenueCatAppUserId,
            productId: subscription.productId,
            entitlementId: subscription.entitlementId,
          }
        : {
            id: null,
            provider: null,
            platform: null,
            status: VendorSubscriptionStatus.ACTIVE,
            accessActive,
            isFoundingVendor,
            startedAt: null,
            trialEndsAt: null,
            currentPeriodStartsAt: null,
            currentPeriodEndsAt: null,
            willRenew: null,
            revenueCatAppUserId: null,
            productId: null,
            entitlementId: null,
          },
      commissionRate,
      features: plan.features,
      limits: plan.limits,
      foundingOffer: this.toFoundingOfferResponse(foundingOffer),
    };
  }

  private async findVendorForUser(userId: string) {
    return this.prisma.vendor.findFirst({
      where: { userId, deletedAt: null },
    });
  }

  private async findVendorByRevenueCatAppUserId(appUserId: string) {
    return this.prisma.vendor.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: appUserId }, { userId: appUserId }],
      },
    });
  }

  private verifyRevenueCatWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody?: Buffer,
  ) {
    const authSecret = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim();
    const signingSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET?.trim();

    if (!authSecret && !signingSecret) {
      throw new UnauthorizedException(
        'RevenueCat webhook security secret is not configured',
      );
    }

    const authorization = this.getHeader(headers, 'authorization');
    const expectedAuthorization = authSecret
      ? authSecret.startsWith('Bearer ')
        ? authSecret
        : `Bearer ${authSecret}`
      : null;
    const authorizationMatches =
      Boolean(authSecret && authorization === authSecret) ||
      Boolean(expectedAuthorization && authorization === expectedAuthorization);

    const signatureMatches =
      signingSecret && rawBody
        ? this.verifyRevenueCatHmac(
            this.getHeader(headers, 'x-revenuecat-webhook-signature'),
            rawBody,
            signingSecret,
          )
        : false;

    if (!authorizationMatches && !signatureMatches) {
      throw new UnauthorizedException(
        'Invalid RevenueCat webhook authorization or signature',
      );
    }
  }

  private verifyRevenueCatHmac(
    signatureHeader: string | undefined,
    rawBody: Buffer,
    secret: string,
  ) {
    if (!signatureHeader) {
      return false;
    }

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => {
        const [key, value] = part.split('=');
        return [key?.trim(), value?.trim()];
      }),
    );
    const timestamp = parts.t ?? parts.ts ?? parts.timestamp;
    const signature = parts.v1 ?? parts.sig ?? parts.signature;

    if (!timestamp || !signature) {
      return false;
    }

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  private getHeader(
    headers: Record<string, string | string[] | undefined>,
    key: string,
  ) {
    const value =
      headers[key] ??
      headers[key.toLowerCase()] ??
      headers[key.toUpperCase()] ??
      undefined;
    return Array.isArray(value) ? value[0] : value;
  }

  private mapRevenueCatStatus(entitlement: RevenueCatEntitlement) {
    const expiresAt = this.parseNullableDate(entitlement.expires_date);
    const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false;

    if (isExpired) {
      return VendorSubscriptionStatus.EXPIRED;
    }

    if (entitlement.billing_issues_detected_at) {
      return expiresAt
        ? VendorSubscriptionStatus.GRACE_PERIOD
        : VendorSubscriptionStatus.PAST_DUE;
    }

    if (entitlement.unsubscribe_detected_at) {
      return VendorSubscriptionStatus.CANCELED;
    }

    if (entitlement.period_type?.toLowerCase() === 'trial') {
      return VendorSubscriptionStatus.TRIALING;
    }

    return VendorSubscriptionStatus.ACTIVE;
  }

  private mapRevenueCatStoreToPlatform(store?: string | null) {
    const normalized = store?.toUpperCase() ?? '';
    if (normalized.includes('APP_STORE') || normalized.includes('APPLE')) {
      return VendorSubscriptionPlatform.IOS;
    }
    if (normalized.includes('PLAY') || normalized.includes('GOOGLE')) {
      return VendorSubscriptionPlatform.ANDROID;
    }
    if (normalized.includes('STRIPE') || normalized.includes('WEB')) {
      return VendorSubscriptionPlatform.WEB;
    }
    return VendorSubscriptionPlatform.UNKNOWN;
  }

  private hasAccess(status: VendorSubscriptionStatus, expiresAt?: Date | null) {
    if (!ACCESSIBLE_STATUSES.has(status)) {
      return false;
    }

    return !expiresAt || expiresAt.getTime() > Date.now();
  }

  private isWithinFoundingWindow(
    date: Date,
    offer: { active: boolean; startsAt: Date; endsAt: Date },
  ) {
    if (!offer.active) {
      return false;
    }
    return date >= offer.startsAt && date <= offer.endsAt;
  }

  private parseNullableDate(value?: string | null) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private hashEventId(input: string) {
    return createHash('sha256').update(input).digest('hex');
  }

  private toFoundingOfferResponse(offer: {
    active: boolean;
    startsAt: Date;
    endsAt: Date;
    discountPercent: any;
    discountStartMonth: number;
    discountEndMonth: number;
    trialDays: number;
  }) {
    const now = new Date();
    return {
      active: offer.active,
      availableNow: offer.active && now >= offer.startsAt && now <= offer.endsAt,
      startsAt: offer.startsAt,
      endsAt: offer.endsAt,
      discountPercent: Number(offer.discountPercent),
      discountStartMonth: offer.discountStartMonth,
      discountEndMonth: offer.discountEndMonth,
      trialDays: offer.trialDays,
    };
  }

  private toPlanResponse(plan: any) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      monthlyPrice: Number(plan.monthlyPrice),
      standardCommissionRate: Number(plan.standardCommissionRate),
      foundingCommissionRate: Number(plan.foundingCommissionRate),
      trialDays: plan.trialDays,
      features: plan.features,
      limits: plan.limits,
      active: plan.active,
      sortOrder: plan.sortOrder,
      providerProducts:
        plan.providerProducts?.map((item) => ({
          id: item.id,
          provider: item.provider,
          platform: item.platform,
          productId: item.productId,
          entitlementId: item.entitlementId,
          revenueCatOfferingId: item.revenueCatOfferingId,
          revenueCatPackageId: item.revenueCatPackageId,
          stripeProductId: item.stripeProductId,
          stripePriceId: item.stripePriceId,
          active: item.active,
        })) ?? undefined,
    };
  }
}
