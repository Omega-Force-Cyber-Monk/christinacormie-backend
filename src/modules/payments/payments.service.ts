import { platformCommissionRate } from '../bookings/quote-financials';
import { getVendorPlanConfig } from '../vendors/vendor-plan-access';
import { VENDOR_PLAN_CONFIG } from '../vendors/vendor-plan.config';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VendorPlan } from '@prisma/client';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateConnectAccountDto } from './dto/create-connect-account.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { CreateVendorSubscriptionDto } from './dto/create-vendor-subscription.dto';
import { NotificationEventType } from '../notifications/enums/notification-event-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsRepository } from './payments.repository';
import { StripeClientService } from './stripe-client.service';

@Injectable()
export class PaymentsService {
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly stripeClient: StripeClientService,
  ) {}

  async createConnectAccount(userId: string, dto: CreateConnectAccountDto) {
    const vendor = await this.ensureVendor(userId);
    let paymentAccount = vendor.paymentAccount;

    if (!paymentAccount) {
      const stripeAccount = await this.stripeClient.createConnectAccount(
        dto.country ?? 'US',
      );

      paymentAccount = await this.paymentsRepository.upsertVendorPaymentAccount(
        vendor.id,
        stripeAccount.id,
        {
          onboardingCompleted: Boolean(stripeAccount.details_submitted),
          chargesEnabled: Boolean(stripeAccount.charges_enabled),
          payoutsEnabled: Boolean(stripeAccount.payouts_enabled),
          disabledReason: stripeAccount.requirements?.disabled_reason ?? null,
        },
      );
    }

    const refreshUrl = dto.refreshUrl ?? process.env.STRIPE_CONNECT_REFRESH_URL;
    const returnUrl = dto.returnUrl ?? process.env.STRIPE_CONNECT_RETURN_URL;

    if (!refreshUrl || !returnUrl) {
      throw new BadRequestException(
        'Stripe Connect refresh/return URLs are not configured',
      );
    }

    const accountLink = await this.stripeClient.createAccountLink(
      paymentAccount.stripeAccountId,
      refreshUrl,
      returnUrl,
    );

    return {
      paymentAccount,
      onboardingUrl: accountLink.url,
    };
  }

  async getVendorPaymentAccount(userId: string) {
    const vendor = await this.ensureVendor(userId);
    return vendor.paymentAccount;
  }

  async getVendorPayouts(userId: string) {
    const vendor = await this.ensureVendor(userId);
    return this.paymentsRepository.findVendorPayouts(vendor.id);
  }

  async createVendorSubscriptionIntent(
    userId: string,
    dto: CreateVendorSubscriptionDto,
  ) {
    const vendor = await this.paymentsRepository.findVendorByUserId(userId);

    if (!vendor || vendor.deletedAt) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if ((dto.plan as VendorPlan) === VendorPlan.FREE) {
      throw new BadRequestException(
        'Free plan does not require subscription payment',
      );
    }

    const planConfig = VENDOR_PLAN_CONFIG[dto.plan];
    if (!planConfig) {
      throw new BadRequestException('Invalid vendor subscription plan');
    }

    if (['TRIALING', 'ACTIVE'].includes(vendor.subscriptionStatus)) {
      if (vendor.selectedPlan === dto.plan) {
        throw new BadRequestException(
          'Vendor subscription is already active for this plan',
        );
      }

      throw new BadRequestException(
        'Changing an active vendor subscription plan is not available yet',
      );
    }

    const priceId = this.resolveVendorStripePriceId(dto.plan);
    const customerId =
      vendor.stripeCustomerId ??
      (
        await this.stripeClient.createCustomer({
          email: vendor.businessEmail ?? vendor.user.email,
          name:
            vendor.businessName ??
            vendor.user.profile?.displayName ??
            vendor.user.email,
          vendorId: vendor.id,
        })
      ).id;

    if (!vendor.stripeCustomerId) {
      await this.paymentsRepository.updateVendorStripeCustomer(
        vendor.id,
        customerId,
      );
    }

    const [ephemeralKey, subscription] = await Promise.all([
      this.stripeClient.createEphemeralKey(customerId),
      this.stripeClient.createSubscription(
        {
          customerId,
          priceId,
          vendorId: vendor.id,
          plan: dto.plan,
          trialDays: this.vendorSubscriptionTrialDays(),
        },
        { idempotencyKey: `vendor-subscription-${vendor.id}-${dto.plan}` },
      ),
    ]);

    const subscriptionStatus = this.mapStripeSubscriptionStatus(
      subscription.status,
    );
    const trialStartedAt = this.fromStripeTimestamp(subscription.trial_start);
    const trialEndsAt = this.fromStripeTimestamp(subscription.trial_end);
    const currentPeriodEnd = this.fromStripeTimestamp(
      subscription.current_period_end,
    );

    const updatedVendor =
      await this.paymentsRepository.updateVendorSubscription(vendor.id, {
        selectedPlan: dto.plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus,
        trialStartedAt: trialStartedAt ?? vendor.trialStartedAt ?? new Date(),
        trialEndsAt,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
      });

    const clientSecret = this.resolveSubscriptionClientSecret(subscription);

    return {
      vendor: {
        id: updatedVendor.id,
        selectedPlan: updatedVendor.selectedPlan,
        subscriptionStatus: updatedVendor.subscriptionStatus,
        stripeCustomerId: updatedVendor.stripeCustomerId,
        stripeSubscriptionId: updatedVendor.stripeSubscriptionId,
        trialStartedAt: updatedVendor.trialStartedAt,
        trialEndsAt: updatedVendor.trialEndsAt,
        subscriptionCurrentPeriodEnd:
          updatedVendor.subscriptionCurrentPeriodEnd,
        isFoundingMember: updatedVendor.isFoundingMember,
        foundingDiscountEndsAt: updatedVendor.foundingDiscountEndsAt,
        lockedCommissionRate: updatedVendor.lockedCommissionRate,
      },
      stripe: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? null,
        customerId,
        customerEphemeralKeySecret: ephemeralKey.secret,
        subscriptionId: subscription.id,
        clientSecret,
        clientSecretType: this.resolveSubscriptionClientSecretType(subscription),
      },
    };
  }

  async createBookingPaymentIntent(
    userId: string,
    bookingId: string,
    dto: CreateBookingPaymentDto,
  ) {
    const existingPayment =
      await this.paymentsRepository.findPaymentByIdempotencyKey(
        dto.idempotencyKey,
      );

    if (existingPayment) {
      return { payment: existingPayment, clientSecret: null };
    }

    const booking =
      await this.paymentsRepository.findBookingForPayment(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenException('Booking does not belong to this customer');
    }

    if (booking.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('Booking is not ready for payment');
    }

    if (booking.payments.some((payment) => payment.status === 'SUCCEEDED')) {
      throw new BadRequestException('Booking is already paid');
    }

    if (
      booking.payments.some((payment) =>
        ['PENDING', 'PROCESSING'].includes(payment.status),
      )
    ) {
      throw new BadRequestException(
        'Booking already has a payment in progress',
      );
    }

    this.ensureVendorPaymentAccountReady(booking.vendor.paymentAccount);

    const financials = this.resolveBookingFinancials(booking);

    if (financials.chargeAmount <= 0) {
      throw new BadRequestException('Booking amount must be greater than zero');
    }

    const currency = dto.currency ?? 'USD';
    let payment;

    try {
      payment = await this.paymentsRepository.createPaymentRecord({
        bookingId,
        payerUserId: userId,
        vendorId: booking.vendorId,
        amount: financials.chargeAmount,
        currency,
        idempotencyKey: dto.idempotencyKey,
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const duplicate =
          await this.paymentsRepository.findPaymentByIdempotencyKey(
            dto.idempotencyKey,
          );
        return { payment: duplicate, clientSecret: null };
      }

      throw error;
    }

    let paymentResponse: { payment: any; clientSecret: string | null } | null =
      null;

    try {
      const paymentIntent = await this.stripeClient.createPaymentIntent(
        {
          amount: this.toMinorUnit(financials.chargeAmount),
          currency,
          paymentId: payment.id,
          bookingId,
        },
        { idempotencyKey: dto.idempotencyKey },
      );

      await this.paymentsRepository.updatePaymentIntent(
        payment.id,
        paymentIntent.id,
      );

      paymentResponse = {
        payment: {
          ...payment,
          stripePaymentIntentId: paymentIntent.id,
          status: 'PROCESSING',
        },
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      await this.paymentsRepository.markPaymentStatusById(payment.id, 'FAILED');
      throw error;
    }

    if (!paymentResponse) {
      throw new BadRequestException('Payment could not be initialized');
    }

    await this.notificationsService.notifyPaymentUpdate(
      paymentResponse.payment,
      'Payment started',
      `Payment for booking ${booking.bookingNumber} has started.`,
    );

    return paymentResponse;
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.payerUserId === userId) {
      return payment;
    }

    const vendor = await this.paymentsRepository.findVendorByUserId(userId);

    if (!vendor || payment.vendorId !== vendor.id) {
      throw new ForbiddenException('Payment is not visible to this user');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return payment;
  }

  async releaseBookingPayout(bookingId: string) {
    const payment =
      await this.paymentsRepository.findSucceededPaymentForBooking(bookingId);

    if (!payment) {
      throw new BadRequestException('Booking deposit payment is not completed');
    }

    this.ensureVendorPaymentAccountReady(payment.vendor.paymentAccount);
    const paymentAccount = payment.vendor.paymentAccount;

    let payout = payment.payout;

    if (!payout) {
      if (!payment.commission) {
        throw new BadRequestException('Booking payout is not ready');
      }

      payout = await this.paymentsRepository.createPendingPayoutForPayment({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        vendorId: payment.vendorId,
        amount: Number(payment.commission.vendorNetAmount),
        currency: payment.currency,
      });
    }

    if (payout.status === 'PAID') {
      return payout;
    }

    if (payout.status === 'CANCELLED') {
      throw new BadRequestException(
        'Booking payout has been cancelled and cannot be released',
      );
    }

    if (!['PENDING', 'FAILED'].includes(payout.status)) {
      throw new BadRequestException('Booking payout is already processing');
    }

    if (Number(payout.amount) <= 0) {
      throw new BadRequestException(
        'Booking payout amount must be greater than zero',
      );
    }

    await this.paymentsRepository.markPayoutProcessing(payout.id);

    try {
      const transfer = await this.stripeClient.createTransfer(
        {
          amount: this.toMinorUnit(Number(payout.amount)),
          currency: payout.currency,
          connectedAccountId: paymentAccount.stripeAccountId,
          paymentId: payment.id,
          bookingId: payment.bookingId,
        },
        { idempotencyKey: `booking-payout-${bookingId}` },
      );

      return this.paymentsRepository.markPayoutPaid(payout.id, transfer.id);
    } catch (error: any) {
      await this.paymentsRepository.markPayoutFailed(
        payout.id,
        error?.message ?? 'Stripe transfer failed',
      );
      throw error;
    }
  }

  async retryFailedPayout(payoutId: string) {
    const payout = await this.paymentsRepository.findPayoutById(payoutId);

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== 'FAILED') {
      throw new BadRequestException('Only failed payouts can be retried');
    }

    if (!payout.paymentId || !payout.bookingId || !payout.payment) {
      throw new BadRequestException(
        'This payout is not linked to a booking payment and cannot be retried',
      );
    }

    this.ensureVendorPaymentAccountReady(payout.vendor.paymentAccount);

    if (Number(payout.amount) <= 0) {
      throw new BadRequestException(
        'Payout amount must be greater than zero before retrying',
      );
    }

    await this.paymentsRepository.markPayoutProcessing(payout.id);

    try {
      const transfer = await this.stripeClient.createTransfer(
        {
          amount: this.toMinorUnit(Number(payout.amount)),
          currency: payout.currency,
          connectedAccountId: payout.vendor.paymentAccount!.stripeAccountId,
          paymentId: payout.paymentId,
          bookingId: payout.bookingId,
        },
        { idempotencyKey: `booking-payout-${payout.bookingId}` },
      );

      return this.paymentsRepository.markPayoutPaid(payout.id, transfer.id);
    } catch (error: any) {
      await this.paymentsRepository.markPayoutFailed(
        payout.id,
        error?.message ?? 'Stripe transfer retry failed',
      );
      throw error;
    }
  }

  async refundBookingPaymentForIssue(bookingId: string, reason?: string) {
    const payment =
      await this.paymentsRepository.findSucceededPaymentForBooking(bookingId);

    if (!payment) {
      throw new BadRequestException('Booking deposit payment is not completed');
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe payment intent');
    }

    if (payment.payout?.status === 'PAID') {
      throw new BadRequestException(
        'Vendor payout has already been released, so this booking cannot be fully refunded through issue resolution',
      );
    }

    if (payment.payout?.status === 'PROCESSING') {
      throw new BadRequestException(
        'Vendor payout is currently processing. Wait for the payout result before refunding',
      );
    }

    if (
      payment.refunds.some((refund) =>
        ['PENDING', 'PROCESSING', 'REFUNDED'].includes(refund.status),
      )
    ) {
      throw new BadRequestException(
        'A refund already exists for this booking payment',
      );
    }

    const amount = Number(payment.amount);
    const stripeRefund = await this.stripeClient.createRefund(
      {
        paymentIntentId: payment.stripePaymentIntentId,
        amount: this.toMinorUnit(amount),
        reason: 'requested_by_customer',
        paymentId: payment.id,
      },
      { idempotencyKey: `issue-full-refund-${payment.id}` },
    );

    const refund = await this.paymentsRepository.createRefundRecord({
      paymentId: payment.id,
      stripeRefundId: stripeRefund.id,
      amount,
      reason: reason ?? 'Full refund after admin issue resolution',
      status: this.mapStripeRefundStatus(stripeRefund.status),
    });

    let cancelledPayout: any = null;
    if (payment.payout && payment.payout.status !== 'CANCELLED') {
      cancelledPayout = await this.paymentsRepository.markPayoutCancelled(
        payment.payout.id,
        'Cancelled because admin approved full refund for booking issue',
      );
    }

    await this.notificationsService.notifyPaymentUpdate(
      payment,
      'Refund started',
      `Full refund for booking ${payment.booking.bookingNumber} has started.`,
    );

    return {
      payment,
      refund,
      payout: cancelledPayout ?? payment.payout,
    };
  }

  async createRefund(userId: string, paymentId: string, dto: CreateRefundDto) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const vendor = await this.ensureVendor(userId);

    if (payment.vendorId !== vendor.id) {
      throw new ForbiddenException('Payment does not belong to this vendor');
    }

    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }

    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('Payment has no Stripe payment intent');
    }

    const amount = dto.amount ?? Number(payment.amount);

    if (amount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    const stripeRefund = await this.stripeClient.createRefund(
      {
        paymentIntentId: payment.stripePaymentIntentId,
        amount: this.toMinorUnit(amount),
        reason: this.toStripeRefundReason(dto.reason),
        paymentId: payment.id,
      },
      { idempotencyKey: `refund-${payment.id}-${amount}` },
    );

    const refund = await this.paymentsRepository.createRefundRecord({
      paymentId: payment.id,
      stripeRefundId: stripeRefund.id,
      amount,
      reason: dto.reason,
      status: this.mapStripeRefundStatus(stripeRefund.status),
    });

    await this.notificationsService.notifyPaymentUpdate(
      payment,
      'Refund started',
      `Refund for booking ${payment.booking.bookingNumber} has started.`,
    );

    return refund;
  }

  private resolveBookingFinancials(
    booking: Awaited<ReturnType<PaymentsRepository['findBookingForPayment']>>,
  ) {
    const offer = booking?.vendorOffer;
    const quote = booking?.quotes?.[0];

    const paymentPreference =
      offer?.paymentPreference ??
      quote?.paymentPreference ??
      booking?.paymentPreference ??
      'DEPOSIT_ONLY';

    const totalContractAmount = Number(
      offer?.quotedAmount ?? quote?.totalAmount ?? booking?.totalAmount ?? 0,
    );

    let chargeAmount = totalContractAmount;

    if (paymentPreference === 'DEPOSIT_ONLY') {
      const deposit = Number(offer?.depositAmount ?? quote?.depositAmount ?? 0);
      chargeAmount = deposit > 0 ? deposit : totalContractAmount;
    }

    const rate = this.resolveVendorCommissionRate(booking?.vendor);
    const totalCommissionAmount = Number(
      (totalContractAmount * rate).toFixed(2),
    );

    const applicationFeeAmount = Math.min(chargeAmount, totalCommissionAmount);
    const vendorNetAmount = Number(
      (chargeAmount - applicationFeeAmount).toFixed(2),
    );

    return {
      paymentPreference,
      totalContractAmount,
      chargeAmount,
      commissionRate: rate,
      totalCommissionAmount,
      applicationFeeAmount,
      vendorNetAmount,
    };
  }

  async processStripeWebhook(rawBody: Buffer, signatureHeader: string) {
    const event = this.stripeClient.verifyWebhookSignature(
      rawBody,
      signatureHeader,
    );

    try {
      await this.paymentsRepository.createWebhookEvent(event.id, event.type);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const existing = await this.paymentsRepository.findWebhookEvent(
          event.id,
        );

        if (existing?.status !== 'FAILED') {
          return { received: true, duplicate: true };
        }

        await this.paymentsRepository.markWebhookProcessing(event.id);
      }
      if (error?.code !== 'P2002') {
        throw error;
      }
    }

    try {
      await this.handleStripeEvent(event);
      await this.paymentsRepository.markWebhookProcessed(event.id);
      return { received: true };
    } catch (error: any) {
      await this.paymentsRepository.markWebhookFailed(
        event.id,
        error?.message ?? 'Webhook processing failed',
      );
      throw error;
    }
  }

  private async handleStripeEvent(event: any) {
    const object = event.data?.object;

    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(object);
        return;
      case 'payment_intent.succeeded':
        await this.handlePaymentSucceeded(object);
        return;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentStatus(object, 'FAILED');
        return;
      case 'payment_intent.canceled':
        await this.handlePaymentIntentStatus(object, 'CANCELLED');
        return;
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
      case 'charge.refund.updated':
        await this.handleRefundUpdated(object);
        return;
      case 'charge.refunded':
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await this.handleVendorSubscriptionUpdated(object);
        return;
      case 'invoice.payment_succeeded':
        await this.handleSubscriptionInvoiceUpdated(object, 'ACTIVE');
        return;
      case 'invoice.payment_failed':
        await this.handleSubscriptionInvoiceUpdated(object, 'PAST_DUE');
        return;
      default:
        return;
    }
  }

  private async handleVendorSubscriptionUpdated(subscription: any) {
    const vendorId = subscription.metadata?.vendorId;
    const vendor = vendorId
      ? await this.paymentsRepository.updateVendorSubscription(vendorId, {
          selectedPlan: subscription.metadata?.plan,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: this.mapStripeSubscriptionStatus(
            subscription.status,
          ),
          trialStartedAt: this.fromStripeTimestamp(subscription.trial_start),
          trialEndsAt: this.fromStripeTimestamp(subscription.trial_end),
          subscriptionCurrentPeriodEnd: this.fromStripeTimestamp(
            subscription.current_period_end,
          ),
        })
      : subscription.id
        ? await this.syncVendorSubscriptionByStripeId(subscription)
        : null;

    return vendor;
  }

  private async syncVendorSubscriptionByStripeId(subscription: any) {
    const vendor =
      await this.paymentsRepository.findVendorByStripeSubscriptionId(
        subscription.id,
      );

    if (!vendor) {
      return null;
    }

    return this.paymentsRepository.updateVendorSubscription(vendor.id, {
      selectedPlan: subscription.metadata?.plan,
      subscriptionStatus: this.mapStripeSubscriptionStatus(subscription.status),
      trialStartedAt: this.fromStripeTimestamp(subscription.trial_start),
      trialEndsAt: this.fromStripeTimestamp(subscription.trial_end),
      subscriptionCurrentPeriodEnd: this.fromStripeTimestamp(
        subscription.current_period_end,
      ),
    });
  }

  private async handleSubscriptionInvoiceUpdated(
    invoice: any,
    fallbackStatus: string,
  ) {
    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id;

    if (!subscriptionId) {
      return;
    }

    const vendor =
      await this.paymentsRepository.findVendorByStripeSubscriptionId(
        subscriptionId,
      );

    if (!vendor) {
      return;
    }

    await this.paymentsRepository.updateVendorSubscription(vendor.id, {
      subscriptionStatus: fallbackStatus,
      subscriptionCurrentPeriodEnd: this.fromStripeTimestamp(
        invoice.lines?.data?.[0]?.period?.end,
      ),
    });
  }

  private async handleAccountUpdated(account: any) {
    const existing =
      await this.paymentsRepository.findVendorPaymentAccountByStripeId(
        account.id,
      );

    if (!existing) {
      return;
    }

    await this.paymentsRepository.updateVendorPaymentAccountByStripeId(
      account.id,
      {
        onboardingCompleted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
        payoutsEnabled: Boolean(account.payouts_enabled),
        disabledReason: account.requirements?.disabled_reason ?? null,
      },
    );
  }

  private async handlePaymentSucceeded(paymentIntent: any) {
    const payment =
      await this.paymentsRepository.findPaymentByStripePaymentIntentId(
        paymentIntent.id,
      );

    if (!payment || payment.status === 'SUCCEEDED') {
      return;
    }

    const booking = await this.paymentsRepository.findBookingForPayment(
      payment.bookingId,
    );
    const financials = this.resolveBookingFinancials(booking);

    const updatedPayment = await this.paymentsRepository.markPaymentSucceeded(
      paymentIntent.id,
      {
        rate: financials.commissionRate,
        amount: financials.applicationFeeAmount,
        vendorNetAmount: financials.vendorNetAmount,
      },
    );

    await this.notificationsService.notifyPaymentUpdate(
      updatedPayment,
      'Payment succeeded',
      `Payment for booking ${updatedPayment.booking.bookingNumber} succeeded.`,
      NotificationEventType.PAYMENT_SUCCEEDED,
    );

    await this.notificationsService.notifyVendorPaymentUpdate(
      updatedPayment,
      'Deposit received',
      `Deposit for booking ${updatedPayment.booking.bookingNumber} succeeded. Payout will be released after completion approval.`,
      NotificationEventType.PAYMENT_SUCCEEDED,
    );
  }

  private async handlePaymentIntentStatus(paymentIntent: any, status: string) {
    const payment =
      await this.paymentsRepository.findPaymentByStripePaymentIntentId(
        paymentIntent.id,
      );

    if (!payment) {
      return;
    }

    const updatedPayment = await this.paymentsRepository.markPaymentStatus(
      paymentIntent.id,
      status,
    );

    await this.notificationsService.notifyPaymentUpdate(
      updatedPayment,
      'Payment update',
      `Payment for booking ${updatedPayment.booking.bookingNumber} is ${status}.`,
      NotificationEventType.PAYMENT_FAILED,
    );

    if (status === 'FAILED') {
      await this.notificationsService.notifyAdmins({
        title: 'Payment attention required',
        message: `Payment failed for booking ${updatedPayment.booking.bookingNumber}.`,
        bookingId: updatedPayment.bookingId,
        actionUrl: `/api/v1/admin/bookings/${updatedPayment.bookingId}`,
        priority: 'HIGH',
        metadata: {
          eventType: NotificationEventType.PAYMENT_ATTENTION_REQUIRED,
          paymentId: updatedPayment.id,
          bookingId: updatedPayment.bookingId,
          status,
        },
        pushData: {
          eventType: NotificationEventType.PAYMENT_ATTENTION_REQUIRED,
          paymentId: updatedPayment.id,
          bookingId: updatedPayment.bookingId,
        },
      });
    }
  }

  private async handleRefundUpdated(refund: any) {
    if (refund.status === 'succeeded') {
      await this.paymentsRepository.markRefundSucceeded(
        refund.id,
        refund.payment_intent,
        refund.amount ? refund.amount / 100 : undefined,
      );
      return;
    }

    if (refund.status === 'failed') {
      const failedRefund = await this.paymentsRepository.markRefundFailed(
        refund.id,
      );

      await this.notificationsService.notifyAdmins({
        title: 'Refund attention required',
        message: `Refund failed for booking ${failedRefund.payment.booking.bookingNumber}.`,
        bookingId: failedRefund.payment.bookingId,
        actionUrl: `/api/v1/admin/bookings/${failedRefund.payment.bookingId}`,
        priority: 'HIGH',
        metadata: {
          eventType: NotificationEventType.PAYMENT_ATTENTION_REQUIRED,
          refundId: failedRefund.id,
          paymentId: failedRefund.paymentId,
          bookingId: failedRefund.payment.bookingId,
          status: failedRefund.status,
        },
        pushData: {
          eventType: NotificationEventType.PAYMENT_ATTENTION_REQUIRED,
          refundId: failedRefund.id,
          paymentId: failedRefund.paymentId,
          bookingId: failedRefund.payment.bookingId,
        },
      });
    }
  }

  private async ensureVendor(userId: string) {
    const vendor = await this.paymentsRepository.findVendorByUserId(userId);

    if (!vendor || vendor.deletedAt) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return vendor;
  }

  private ensureVendorPaymentAccountReady(
    paymentAccount?: {
      stripeAccountId?: string | null;
      onboardingCompleted?: boolean | null;
      chargesEnabled?: boolean | null;
      payoutsEnabled?: boolean | null;
    } | null,
  ): asserts paymentAccount is {
    stripeAccountId: string;
    onboardingCompleted: true;
    chargesEnabled: true;
    payoutsEnabled: true;
  } {
    if (!paymentAccount?.stripeAccountId) {
      throw new BadRequestException(
        'Vendor payout setup is incomplete. The vendor must connect Stripe before customer payment can be accepted.',
      );
    }

    if (
      !paymentAccount.onboardingCompleted ||
      !paymentAccount.chargesEnabled ||
      !paymentAccount.payoutsEnabled
    ) {
      throw new BadRequestException(
        'Vendor payout setup is not ready. The vendor must complete Stripe onboarding and enable payouts before customer payment can be accepted.',
      );
    }
  }

  private calculateCommission(amount: number, vendor?: any) {
    const rate = this.resolveVendorCommissionRate(vendor);
    const commissionAmount = Number((amount * rate).toFixed(2));

    return {
      rate,
      amount: commissionAmount,
      vendorNetAmount: Number((amount - commissionAmount).toFixed(2)),
    };
  }

  private resolveVendorCommissionRate(vendor?: {
    lockedCommissionRate?: unknown;
    selectedPlan?: string | null;
  } | null) {
    if (
      vendor?.lockedCommissionRate !== null &&
      vendor?.lockedCommissionRate !== undefined
    ) {
      const locked = Number(vendor.lockedCommissionRate);
      if (Number.isFinite(locked) && locked >= 0 && locked <= 1) {
        return locked;
      }
    }

    const planRate = getVendorPlanConfig(vendor?.selectedPlan)
      .normalCommissionRate;

    return planRate ?? platformCommissionRate();
  }

  private toMinorUnit(amount: number) {
    return Math.round(amount * 100);
  }

  private toStripeRefundReason(reason?: string) {
    if (
      reason === 'duplicate' ||
      reason === 'fraudulent' ||
      reason === 'requested_by_customer'
    ) {
      return reason;
    }

    return undefined;
  }

  private mapStripeRefundStatus(status: string) {
    if (status === 'succeeded') {
      return 'REFUNDED';
    }

    if (status === 'failed') {
      return 'FAILED';
    }

    if (status === 'canceled') {
      return 'CANCELLED';
    }

    return 'PENDING';
  }

  private resolveVendorStripePriceId(plan: VendorPlan) {
    const keyByPlan: Record<VendorPlan, string | null> = {
      [VendorPlan.FREE]: null,
      [VendorPlan.STARTER]: process.env.STRIPE_VENDOR_STARTER_PRICE_ID ?? null,
      [VendorPlan.PRO]: process.env.STRIPE_VENDOR_PRO_PRICE_ID ?? null,
      [VendorPlan.ELITE]: process.env.STRIPE_VENDOR_ELITE_PRICE_ID ?? null,
    };
    const priceId = keyByPlan[plan];

    if (!priceId && !process.env.STRIPE_SECRET_KEY?.includes('change_me')) {
      throw new BadRequestException(
        `Stripe price id is not configured for ${plan} plan`,
      );
    }

    return priceId ?? `price_mock_${plan.toLowerCase()}`;
  }

  private vendorSubscriptionTrialDays() {
    const value = Number(process.env.VENDOR_SUBSCRIPTION_TRIAL_DAYS ?? 90);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 90;
  }

  private mapStripeSubscriptionStatus(status?: string) {
    switch (status) {
      case 'trialing':
        return 'TRIALING';
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELED';
      case 'unpaid':
        return 'UNPAID';
      case 'incomplete_expired':
        return 'INACTIVE';
      case 'incomplete':
      default:
        return 'INCOMPLETE';
    }
  }

  private fromStripeTimestamp(value?: number | string | null) {
    if (!value) {
      return null;
    }

    const timestamp = Number(value);
    if (!Number.isFinite(timestamp)) {
      return null;
    }

    return new Date(timestamp * 1000);
  }

  private resolveSubscriptionClientSecret(subscription: any) {
    const setupIntent = subscription.pending_setup_intent;
    if (setupIntent?.client_secret) {
      return setupIntent.client_secret;
    }

    const paymentIntent = subscription.latest_invoice?.payment_intent;
    return paymentIntent?.client_secret ?? null;
  }

  private resolveSubscriptionClientSecretType(subscription: any) {
    if (subscription.pending_setup_intent?.client_secret) {
      return 'setup_intent';
    }

    if (subscription.latest_invoice?.payment_intent?.client_secret) {
      return 'payment_intent';
    }

    return null;
  }
}
