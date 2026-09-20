import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus } from '../../common/enums/account-status.enum';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { BookingsService } from '../bookings/bookings.service';
import { ResolveBookingIssueDto } from '../bookings/dto/resolve-booking-issue.dto';
import { PaymentsService } from '../payments/payments.service';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto';
import {
  ModerateReviewDto,
  ReviewStatusDto,
} from '../reviews/dto/moderate-review.dto';
import { AdminRepository } from './admin.repository';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateNewFoodTruckRequestDto } from './dto/update-new-food-truck-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpdateVerificationDocumentDto } from './dto/update-verification-document.dto';
import { UpsertLeaderboardRuleDto } from './dto/upsert-leaderboard-rule.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';
import { UpdateVendorFoundingMemberDto } from './dto/update-vendor-founding-member.dto';
import { UpdateVendorFoundingOfferDto } from './dto/update-vendor-founding-offer.dto';
import {
  CreateVendorSubscriptionTierDto,
  UpdateVendorSubscriptionTierDto,
} from './dto/vendor-subscription-tier.dto';
import { StripeClientService } from '../payments/stripe-client.service';
import {
  DEFAULT_VENDOR_FOUNDING_OFFER,
  VENDOR_FOUNDING_OFFER_SETTING_KEY,
} from '../vendors/vendor-plan.config';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: PaymentsService,
    private readonly stripeClient: StripeClientService,
  ) {}

  listUsers(query: AdminListQueryDto) {
    return this.adminRepository.listUsers(query);
  }

  getUsersManagement(query: AdminListQueryDto) {
    return this.adminRepository.getUsersManagement(query);
  }

  async getUser(userId: string) {
    const user = await this.adminRepository.getUser(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserStatus(
    adminUserId: string,
    userId: string,
    dto: UpdateAccountStatusDto,
  ) {
    const updated = await this.usersService.updateAccountStatus(
      userId,
      dto.status,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_USER_STATUS',
      'User',
      userId,
      {
        newStatus: dto.status,
      },
    );
    return updated;
  }

  async suspendUser(adminUserId: string, userId: string) {
    const updated = await this.usersService.updateAccountStatus(
      userId,
      AccountStatus.SUSPENDED,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'SUSPEND_USER',
      'User',
      userId,
    );
    return updated;
  }

  async retrieveUser(adminUserId: string, userId: string) {
    const updated = await this.usersService.updateAccountStatus(
      userId,
      AccountStatus.ACTIVE,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'RETRIEVE_USER',
      'User',
      userId,
      { status: AccountStatus.ACTIVE },
    );
    return updated;
  }

  listVendors(query: AdminListQueryDto) {
    return this.adminRepository.listVendors(query);
  }

  getVendorsManagement(query: AdminListQueryDto) {
    return this.adminRepository.getVendorsManagement(query);
  }

  async getVendor(vendorId: string) {
    const vendor = await this.adminRepository.getVendor(vendorId);

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  listNewFoodTruckRequests(query: AdminListQueryDto) {
    return this.adminRepository.listNewFoodTruckRequests(query);
  }

  async updateNewFoodTruckRequest(
    adminUserId: string,
    requestId: string,
    dto: UpdateNewFoodTruckRequestDto,
  ) {
    const request = await this.adminRepository.updateNewFoodTruckRequest(
      requestId,
      adminUserId,
      dto,
    );

    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_NEW_FOOD_TRUCK_REQUEST',
      'NewFoodTruckRequest',
      requestId,
      dto as any,
    );

    return request;
  }

  async suspendVendor(adminUserId: string, vendorId: string) {
    const vendor = await this.adminRepository.updateVendorStatus(
      vendorId,
      'SUSPENDED',
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'SUSPEND_VENDOR',
      'Vendor',
      vendorId,
    );
    return vendor;
  }

  async retrieveVendor(adminUserId: string, vendorId: string) {
    const existing = await this.adminRepository.getVendor(vendorId);

    if (!existing) {
      throw new NotFoundException('Vendor not found');
    }

    const nextStatus = existing.isVerified ? 'APPROVED' : 'PENDING_APPROVAL';
    const vendor = await this.adminRepository.updateVendorStatus(
      vendorId,
      nextStatus,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'RETRIEVE_VENDOR',
      'Vendor',
      vendorId,
      { status: nextStatus },
    );
    return vendor;
  }

  async removeVendorBadge(
    adminUserId: string,
    vendorId: string,
    badgeId: string,
  ) {
    const badge = await this.adminRepository.removeVendorBadge(
      vendorId,
      badgeId,
    );

    if (!badge) {
      throw new NotFoundException('Vendor badge not found');
    }

    await this.adminRepository.createAuditLog(
      adminUserId,
      'REMOVE_VENDOR_BADGE',
      'VendorBadge',
      badge.id,
      { vendorId, badgeId },
    );

    return badge;
  }

  listVerificationRequests(query: AdminListQueryDto) {
    return this.adminRepository.listVerificationRequests(query);
  }

  async updateVerificationDocument(
    adminUserId: string,
    requestId: string,
    documentKey: string,
    dto: UpdateVerificationDocumentDto,
  ) {
    const request = await this.adminRepository.updateVerificationDocument(
      requestId,
      documentKey,
      adminUserId,
      dto,
    );

    if (!request) {
      throw new NotFoundException('Verification document not found');
    }

    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_VENDOR_VERIFICATION_DOCUMENT',
      'VendorVerificationRequest',
      requestId,
      { documentKey, ...dto },
    );

    return request;
  }

  listFoodTrucks(query: AdminListQueryDto) {
    return this.adminRepository.listFoodTrucks(query);
  }

  async getFoodTruck(foodTruckId: string) {
    const foodTruck = await this.adminRepository.getFoodTruck(foodTruckId);

    if (!foodTruck) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  async updateFoodTruck(
    adminUserId: string,
    foodTruckId: string,
    dto: UpdateFoodTruckAdminDto,
  ) {
    const updated = await this.adminRepository.updateFoodTruck(
      foodTruckId,
      dto,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_FOOD_TRUCK',
      'FoodTruck',
      foodTruckId,
      dto as any,
    );
    return updated;
  }

  listBookings(query: AdminListQueryDto) {
    return this.adminRepository.listBookings(query);
  }

  getBookingsManagement(query: AdminListQueryDto) {
    return this.adminRepository.getBookingsManagement(query);
  }

  async getBooking(bookingId: string) {
    const booking = await this.adminRepository.getBooking(bookingId);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  resolveBookingIssue(
    adminUserId: string,
    bookingId: string,
    issueId: string,
    dto: ResolveBookingIssueDto,
  ) {
    return this.bookingsService.resolveIssue(
      adminUserId,
      bookingId,
      issueId,
      dto,
    );
  }

  listPayments(query: AdminListQueryDto) {
    return this.adminRepository.listPayments(query);
  }

  getPaymentsManagement(query: AdminListQueryDto) {
    return this.adminRepository.getPaymentsManagement(query);
  }

  async approvePayout(adminUserId: string, payoutId: string) {
    const payout = await this.paymentsService.retryFailedPayout(payoutId);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'RETRY_FAILED_PAYOUT',
      'Payout',
      payoutId,
    );
    return payout;
  }

  async retryPayout(adminUserId: string, payoutId: string) {
    const payout = await this.paymentsService.retryFailedPayout(payoutId);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'RETRY_FAILED_PAYOUT',
      'Payout',
      payoutId,
    );
    return payout;
  }

  async rejectPayout(adminUserId: string, payoutId: string, reason?: string) {
    void adminUserId;
    void payoutId;
    void reason;
    throw new BadRequestException(
      'Manual payout cancellation is not supported. Resolve the related booking issue with FULL_REFUND to refund the customer and cancel the payout.',
    );
  }

  async holdPayout(adminUserId: string, payoutId: string, reason?: string) {
    void adminUserId;
    void payoutId;
    void reason;
    throw new BadRequestException(
      'Manual payout hold is not supported. An open booking issue automatically freezes payout until admin resolution.',
    );
  }

  listCommissions(query: AdminListQueryDto) {
    return this.adminRepository.listCommissions(query);
  }

  listRefunds(query: AdminListQueryDto) {
    return this.adminRepository.listRefunds(query);
  }

  listReviews(query: AdminListQueryDto) {
    return this.adminRepository.listReviews(query);
  }

  getReviewsManagement(query: AdminListQueryDto) {
    return this.adminRepository.getReviewsManagement(query);
  }

  async moderateReview(
    adminUserId: string,
    reviewId: string,
    dto: ModerateReviewDto,
  ) {
    const result = await this.reviewsService.moderateReview(
      adminUserId,
      reviewId,
      dto,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'MODERATE_REVIEW',
      'Review',
      reviewId,
      dto as any,
    );
    return result;
  }

  async removeReviewCompletely(adminUserId: string, reviewId: string) {
    const result = await this.reviewsService.moderateReview(
      adminUserId,
      reviewId,
      {
        status: ReviewStatusDto.REMOVED,
        contentHidden: true,
        ratingVisible: false,
        moderationReason: 'Removed by admin',
      },
    );
    await this.adminRepository.resolveReviewReportsForReview(
      reviewId,
      adminUserId,
      'RESOLVED',
      'Review removed by admin',
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'REMOVE_REVIEW',
      'Review',
      reviewId,
    );
    return result;
  }

  async hideReviewTextOnly(adminUserId: string, reviewId: string) {
    const result = await this.reviewsService.moderateReview(
      adminUserId,
      reviewId,
      {
        status: ReviewStatusDto.HIDDEN,
        contentHidden: true,
        ratingVisible: true,
        moderationReason: 'Review text hidden by admin',
      },
    );
    await this.adminRepository.resolveReviewReportsForReview(
      reviewId,
      adminUserId,
      'RESOLVED',
      'Review text hidden by admin',
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'HIDE_REVIEW_TEXT',
      'Review',
      reviewId,
    );
    return result;
  }

  async keepReview(adminUserId: string, reviewId: string) {
    const result = await this.reviewsService.moderateReview(
      adminUserId,
      reviewId,
      {
        status: ReviewStatusDto.PUBLISHED,
        contentHidden: false,
        ratingVisible: true,
        moderationReason: 'Review kept after admin review',
      },
    );
    await this.adminRepository.resolveReviewReportsForReview(
      reviewId,
      adminUserId,
      'DISMISSED',
      'Review kept by admin',
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'KEEP_REVIEW',
      'Review',
      reviewId,
    );
    return result;
  }

  listCommunityRequests(query: AdminListQueryDto) {
    return this.adminRepository.listCommunityRequests(query);
  }

  getCommunityManagement(query: AdminListQueryDto) {
    return this.adminRepository.getCommunityManagement(query);
  }

  async moderateCommunityRequest(
    adminUserId: string,
    requestId: string,
    dto: ModerateCommunityRequestDto,
  ) {
    const updated = await this.adminRepository.moderateCommunityRequest(
      requestId,
      dto,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'MODERATE_COMMUNITY_REQUEST',
      'CommunityRequest',
      requestId,
      dto as any,
    );
    return updated;
  }

  async removeCommunityRequest(adminUserId: string, requestId: string) {
    const updated = await this.adminRepository.removeCommunityRequest(
      requestId,
      adminUserId,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'REMOVE_COMMUNITY_REQUEST',
      'CommunityRequest',
      requestId,
    );
    return updated;
  }

  async deleteCommunityComment(adminUserId: string, commentId: string) {
    const result = await this.adminRepository.deleteCommunityComment(commentId);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'DELETE_COMMUNITY_COMMENT',
      'CommunityRequestComment',
      commentId,
    );
    return result;
  }

  listMarkets() {
    return this.adminRepository.listMarkets();
  }

  async createMarket(adminUserId: string, dto: CreateMarketDto) {
    const market = await this.adminRepository.createMarket(dto);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'CREATE_MARKET',
      'Market',
      market.id,
      dto as any,
    );
    return market;
  }

  async updateMarket(
    adminUserId: string,
    marketId: string,
    dto: UpdateMarketDto,
  ) {
    const market = await this.adminRepository.updateMarket(marketId, dto);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_MARKET',
      'Market',
      marketId,
      dto as any,
    );
    return market;
  }

  listPlatformSettings() {
    return this.adminRepository.listPlatformSettings();
  }

  async getVendorFoundingOffer() {
    const settings = await this.adminRepository.listPlatformSettings();
    const setting = settings.find(
      (item) => item.key === VENDOR_FOUNDING_OFFER_SETTING_KEY,
    );

    return {
      key: VENDOR_FOUNDING_OFFER_SETTING_KEY,
      value: {
        ...DEFAULT_VENDOR_FOUNDING_OFFER,
        ...((setting?.value as object) ?? {}),
      },
      description:
        setting?.description ??
        'Vendor founding offer window and subscription discount configuration.',
      isPublic: setting?.isPublic ?? true,
    };
  }

  updateVendorFoundingOffer(
    adminUserId: string,
    dto: UpdateVendorFoundingOfferDto,
  ) {
    return this.upsertPlatformSetting(
      VENDOR_FOUNDING_OFFER_SETTING_KEY,
      adminUserId,
      {
        value: {
          ...DEFAULT_VENDOR_FOUNDING_OFFER,
          ...dto,
        },
        isPublic: true,
        description:
          'Vendor founding offer window and subscription discount configuration.',
      },
    );
  }

  listVendorSubscriptionTiers(includeInactive = false) {
    return this.adminRepository.listVendorSubscriptionTiers(includeInactive);
  }

  async createVendorSubscriptionTier(
    adminUserId: string,
    dto: CreateVendorSubscriptionTierDto,
  ) {
    const existing = await this.adminRepository.findVendorSubscriptionTierByCode(
      dto.code,
    );
    if (existing) {
      throw new BadRequestException('Subscription tier code already exists');
    }

    const tier = await this.adminRepository.createVendorSubscriptionTier({
      ...this.toTierData(dto),
      active: true,
    });

    const synced = await this.syncTierStripeObjects(tier);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'CREATE_VENDOR_SUBSCRIPTION_TIER',
      'VendorSubscriptionTier',
      synced.id,
      dto as any,
    );
    return synced;
  }

  async updateVendorSubscriptionTier(
    adminUserId: string,
    tierId: string,
    dto: UpdateVendorSubscriptionTierDto,
  ) {
    const existing =
      await this.adminRepository.findVendorSubscriptionTier(tierId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Subscription tier not found');
    }

    const priceChanged =
      dto.monthlyPriceCents !== undefined &&
      dto.monthlyPriceCents !== existing.monthlyPriceCents;

    let tier = await this.adminRepository.updateVendorSubscriptionTier(tierId, {
      ...this.toTierData(dto),
      ...(dto.active !== undefined ? { active: dto.active } : {}),
    });

    tier = await this.syncTierStripeObjects(tier, { forceNewPrice: priceChanged });
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_VENDOR_SUBSCRIPTION_TIER',
      'VendorSubscriptionTier',
      tier.id,
      dto as any,
    );
    return tier;
  }

  async deleteVendorSubscriptionTier(adminUserId: string, tierId: string) {
    const existing =
      await this.adminRepository.findVendorSubscriptionTier(tierId);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Subscription tier not found');
    }

    if (existing.stripePriceId) {
      await this.stripeClient.archivePrice(existing.stripePriceId);
    }
    if (existing.stripeProductId) {
      await this.stripeClient.updateProduct(existing.stripeProductId, {
        active: false,
      });
    }

    const tier = await this.adminRepository.updateVendorSubscriptionTier(
      tierId,
      {
        active: false,
        deletedAt: new Date(),
      },
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'DELETE_VENDOR_SUBSCRIPTION_TIER',
      'VendorSubscriptionTier',
      tier.id,
    );
    return tier;
  }

  async upsertPlatformSetting(
    key: string,
    adminUserId: string,
    dto: UpsertPlatformSettingDto,
  ) {
    const setting = await this.adminRepository.upsertPlatformSetting(
      key,
      adminUserId,
      dto,
    );
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPSERT_PLATFORM_SETTING',
      'PlatformSetting',
      key,
      dto as any,
    );
    return setting;
  }

  async updateVendorFoundingMember(
    adminUserId: string,
    vendorId: string,
    dto: UpdateVendorFoundingMemberDto,
  ) {
    const isFoundingMember = dto.isFoundingMember ?? true;
    const now = new Date();
    const vendor = await this.adminRepository.updateVendorFoundingMember(
      vendorId,
      {
        isFoundingMember,
        foundingJoinedAt: isFoundingMember ? now : null,
        foundingDiscountEndsAt: isFoundingMember
          ? new Date(new Date(now).setMonth(now.getMonth() + 12))
          : null,
        lockedCommissionRate: isFoundingMember
          ? (dto.lockedCommissionRate ?? null)
          : null,
      },
    );

    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_VENDOR_FOUNDING_MEMBER',
      'Vendor',
      vendorId,
      {
        isFoundingMember,
        lockedCommissionRate: dto.lockedCommissionRate ?? null,
        reason: dto.reason ?? null,
      },
    );

    return vendor;
  }

  listLeaderboardRules() {
    return this.adminRepository.listLeaderboardRules();
  }

  async createLeaderboardRule(
    adminUserId: string,
    dto: UpsertLeaderboardRuleDto,
  ) {
    const rule = await this.adminRepository.createLeaderboardRule(dto);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'CREATE_LEADERBOARD_RULE',
      'LeaderboardRule',
      rule.id,
      dto as any,
    );
    return rule;
  }

  async updateLeaderboardRule(
    adminUserId: string,
    ruleId: string,
    dto: UpsertLeaderboardRuleDto,
  ) {
    const rule = await this.adminRepository.updateLeaderboardRule(ruleId, dto);
    await this.adminRepository.createAuditLog(
      adminUserId,
      'UPDATE_LEADERBOARD_RULE',
      'LeaderboardRule',
      ruleId,
      dto as any,
    );
    return rule;
  }

  listLeaderboards(query: AdminListQueryDto) {
    return this.adminRepository.listLeaderboards(query);
  }

  getRewardsManagement(query: AdminListQueryDto) {
    return this.adminRepository.getRewardsManagement(query);
  }

  getDashboard() {
    return this.adminRepository.getDashboard();
  }

  getOverviewAnalytics() {
    return this.adminRepository.getOverviewAnalytics();
  }

  getBookingsAnalytics() {
    return this.adminRepository.getBookingsAnalytics();
  }

  getPaymentsAnalytics() {
    return this.adminRepository.getPaymentsAnalytics();
  }

  getVendorsAnalytics() {
    return this.adminRepository.getVendorsAnalytics();
  }

  private toTierData(
    dto: Partial<CreateVendorSubscriptionTierDto & UpdateVendorSubscriptionTierDto>,
  ) {
    return {
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.legacyPlan !== undefined ? { legacyPlan: dto.legacyPlan } : {}),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.badge !== undefined ? { badge: dto.badge } : {}),
      ...(dto.monthlyPriceCents !== undefined
        ? { monthlyPriceCents: dto.monthlyPriceCents }
        : {}),
      ...(dto.foundingMonthlyPriceCentsAfterTrial !== undefined
        ? {
            foundingMonthlyPriceCentsAfterTrial:
              dto.foundingMonthlyPriceCentsAfterTrial,
          }
        : {}),
      ...(dto.normalCommissionRate !== undefined
        ? { normalCommissionRate: dto.normalCommissionRate }
        : {}),
      ...(dto.foundingCommissionRate !== undefined
        ? { foundingCommissionRate: dto.foundingCommissionRate }
        : {}),
      ...(dto.bookingEnabled !== undefined
        ? { bookingEnabled: dto.bookingEnabled }
        : {}),
      ...(dto.maxStaffAccounts !== undefined
        ? { maxStaffAccounts: dto.maxStaffAccounts }
        : {}),
      ...(dto.maxIncludedTrucks !== undefined
        ? { maxIncludedTrucks: dto.maxIncludedTrucks }
        : {}),
      ...(dto.additionalTruckMonthlyPriceCents !== undefined
        ? {
            additionalTruckMonthlyPriceCents:
              dto.additionalTruckMonthlyPriceCents,
          }
        : {}),
      ...(dto.analyticsLevel !== undefined
        ? { analyticsLevel: dto.analyticsLevel }
        : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.trialDays !== undefined ? { trialDays: dto.trialDays } : {}),
      ...(dto.features !== undefined ? { features: dto.features as any } : {}),
      ...(dto.included !== undefined ? { included: dto.included as any } : {}),
      ...(dto.notIncluded !== undefined
        ? { notIncluded: dto.notIncluded as any }
        : {}),
    };
  }

  private async syncTierStripeObjects(
    tier: any,
    options: { forceNewPrice?: boolean } = {},
  ) {
    if (tier.monthlyPriceCents <= 0) {
      return tier;
    }

    let stripeProductId = tier.stripeProductId;
    if (!stripeProductId) {
      const product = await this.stripeClient.createProduct({
        name: tier.name,
        description: tier.subtitle,
        tierId: tier.id,
        code: tier.code,
      });
      stripeProductId = product.id;
    } else {
      await this.stripeClient.updateProduct(stripeProductId, {
        name: tier.name,
        description: tier.subtitle,
        active: tier.active,
      });
    }

    let stripePriceId = tier.stripePriceId;
    if (!stripePriceId || options.forceNewPrice) {
      if (stripePriceId) {
        await this.stripeClient.archivePrice(stripePriceId);
      }
      const price = await this.stripeClient.createRecurringPrice({
        productId: stripeProductId,
        amountCents: tier.monthlyPriceCents,
        tierId: tier.id,
        code: tier.code,
      });
      stripePriceId = price.id;
    }

    return this.adminRepository.updateVendorSubscriptionTier(tier.id, {
      stripeProductId,
      stripePriceId,
    });
  }
}
