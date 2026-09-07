import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { AwardPointsDto } from './dto/award-points.dto';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { CreateRedemptionCodeDto } from './dto/create-redemption-code.dto';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { UpdateRewardRuleDto } from './dto/update-reward-rule.dto';
import { VendorConfirmRedemptionDto } from './dto/vendor-confirm-redemption.dto';
import { RewardsRepository } from './rewards.repository';

const POINTS_PER_ACTION = [
  { sourceType: 'CHECK_IN', action: 'QR code check-in', points: 10 },
  { sourceType: 'REVIEW', action: 'Leave a verified review', points: 25 },
  { sourceType: 'FOLLOW_TRUCK', action: 'Follow a food truck', points: 5 },
  { sourceType: 'BOOKING', action: 'Make a booking', points: 100 },
  { sourceType: 'COMMUNITY_POST', action: 'Community post', points: 10 },
  { sourceType: 'REFERRAL_CUSTOMER', action: 'Refer a friend', points: 500 },
  { sourceType: 'DAILY_STREAK', action: 'Daily app streak', points: 5 },
  {
    sourceType: 'PROFILE_COMPLETION',
    action: 'Complete profile setup',
    points: 50,
  },
  { sourceType: 'BIRTHDAY_BONUS', action: 'Birthday bonus', points: 50 },
];

const DEFAULT_POINT_RULES: Record<string, number> = {
  CHECK_IN: 10,
  REVIEW: 25,
  FOLLOW_TRUCK: 5,
  BOOKING: 100,
  COMMUNITY_POST: 10,
  REFERRAL_CUSTOMER: 500,
  REFERRAL_VENDOR: 100,
  DAILY_STREAK: 5,
  PROFILE_COMPLETION: 50,
  BIRTHDAY_BONUS: 50,
};

const LOYALTY_TIERS = [
  {
    slug: 'foodie',
    name: 'Foodie',
    requiredPoints: 0,
    creditAmount: 0,
    level: 1,
  },
  {
    slug: 'explorer',
    name: 'Explorer',
    requiredPoints: 500,
    creditAmount: 5,
    level: 2,
  },
  {
    slug: 'drop_hunter',
    name: 'Drop Hunter',
    requiredPoints: 2000,
    creditAmount: 10,
    level: 3,
  },
  {
    slug: 'bitedrop_legend',
    name: 'BiteDrop Legend',
    requiredPoints: 10000,
    creditAmount: 25,
    level: 4,
  },
];

const POINTS_PER_DOLLAR = 100;
const MAX_REDEEM_PER_VISIT = 5;

@Injectable()
export class RewardsService {
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly rewardsRepository: RewardsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  getMyLoyaltyAccount(userId: string) {
    return this.rewardsRepository.ensureLoyaltyAccount(userId);
  }

  async getMyProfileSummary(userId: string) {
    await this.rewardsRepository.refundExpiredPendingRedemptions(userId);
    const account = await this.rewardsRepository.ensureLoyaltyAccount(userId);
    const pointsPerAction = await this.getPointsPerAction();
    const loyalty = this.getLoyaltyProgressForPoints(
      account.availablePoints,
      account.lifetimePoints,
      account.redeemedPoints,
    );
    const profile = account.user?.profile;
    const displayName =
      profile?.displayName ||
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
      account.user?.email ||
      'Customer';

    return {
      profile: {
        id: account.userId,
        name: displayName,
        email: account.user?.email ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        level: loyalty.currentTier.level,
      },
      loyalty,
      tiers: LOYALTY_TIERS.map((tier) => ({
        ...tier,
        isCurrent: tier.slug === loyalty.currentTier.slug,
      })),
      pointsPerAction,
      recentActivity: await this.getRecentActivity(account.transactions ?? []),
      actions: {
        canRedeem: loyalty.availableCreditAmount >= 1,
        canInviteFriends: true,
        canRequestTruck: true,
        canManageSettings: true,
        canOpenSupport: false,
      },
    };
  }

  listRewardRules() {
    return this.rewardsRepository.listActiveRewardRules();
  }

  createRewardRule(adminUserId: string, dto: CreateRewardRuleDto) {
    this.validateRuleWindow(dto.startsAt, dto.endsAt);
    return this.rewardsRepository.createRewardRule(adminUserId, dto);
  }

  async updateRewardRule(rewardRuleId: string, dto: UpdateRewardRuleDto) {
    await this.ensureRewardRuleExists(rewardRuleId);
    this.validateRuleWindow(dto.startsAt, dto.endsAt);
    return this.rewardsRepository.updateRewardRule(rewardRuleId, dto);
  }

  async awardPointsFromDto(dto: AwardPointsDto) {
    await this.ensureUserExists(dto.userId);

    return this.awardPoints(dto.userId, dto.sourceType, dto.sourceId, {
      points: dto.points,
      idempotencyKey: dto.idempotencyKey,
      description: dto.description,
    });
  }

  async awardPoints(
    userId: string,
    sourceType: string,
    sourceId: string,
    options: {
      points?: number;
      idempotencyKey?: string;
      description?: string;
    } = {},
  ) {
    const points = options.points ?? (await this.resolvePoints(sourceType));

    if (points <= 0) {
      return {
        awarded: false,
        transaction: null,
        reason: 'No active point rule',
      };
    }

    const result = await this.rewardsRepository.awardPoints({
      userId,
      points,
      sourceType,
      sourceId,
      idempotencyKey:
        options.idempotencyKey ?? `${sourceType}:${userId}:${sourceId}`,
      description:
        options.description ?? `Awarded ${points} points for ${sourceType}`,
    });

    if (!result.alreadyAwarded) {
      await this.notificationsService.notifyReward(
        userId,
        'Loyalty points added',
        `You earned ${points} points.`,
        {
          sourceType,
          sourceId,
          transactionId: result.transaction.id,
        },
      );
    }

    return {
      awarded: !result.alreadyAwarded,
      transaction: result.transaction,
      reason: result.alreadyAwarded ? 'Points already awarded' : undefined,
    };
  }

  async redeemReward(userId: string, dto: RedeemRewardDto) {
    const rewardRule = await this.ensureRewardRuleExists(dto.rewardRuleId);
    const now = new Date();

    if (!rewardRule.isActive) {
      throw new BadRequestException('Reward rule is inactive');
    }

    if (rewardRule.startsAt && rewardRule.startsAt > now) {
      throw new BadRequestException('Reward is not available yet');
    }

    if (rewardRule.endsAt && rewardRule.endsAt < now) {
      throw new BadRequestException('Reward has expired');
    }

    if (!rewardRule.pointsRequired || rewardRule.pointsRequired <= 0) {
      throw new BadRequestException('Reward does not require points');
    }

    if (rewardRule.maximumUsesPerUser) {
      const useCount = await this.rewardsRepository.countRewardRedemptions(
        userId,
        rewardRule.id,
      );

      if (useCount >= rewardRule.maximumUsesPerUser) {
        throw new BadRequestException('Reward redemption limit reached');
      }
    }

    const account = await this.rewardsRepository.ensureLoyaltyAccount(userId);

    if (account.availablePoints < rewardRule.pointsRequired) {
      throw new BadRequestException('Not enough loyalty points');
    }

    const redemption = await this.rewardsRepository.redeemReward(
      userId,
      rewardRule,
    );

    await this.notificationsService.notifyReward(
      userId,
      'Reward redeemed',
      `You redeemed ${rewardRule.name}.`,
      { redemptionId: redemption.id, rewardRuleId: rewardRule.id },
    );

    return redemption;
  }

  async claimDailyStreak(userId: string) {
    await this.ensureUserExists(userId);
    const today = new Date().toISOString().slice(0, 10);

    const award = await this.awardPoints(userId, 'DAILY_STREAK', userId, {
      idempotencyKey: `DAILY_STREAK:${userId}:${today}`,
      description: 'Daily app streak bonus',
    });

    return {
      awarded: award.awarded,
      pointsEarned: award.transaction?.points ?? 0,
      currentPoints: award.transaction?.balanceAfter ?? null,
      message: award.awarded
        ? 'Daily app streak points added.'
        : 'Daily app streak points already claimed today.',
    };
  }

  async claimBirthdayBonus(userId: string) {
    const account = await this.rewardsRepository.ensureLoyaltyAccount(userId);
    const birthday = account.user?.profile?.dateOfBirth;

    if (!birthday) {
      throw new BadRequestException(
        'Date of birth is required to claim birthday bonus',
      );
    }

    const now = new Date();

    if (
      birthday.getUTCMonth() !== now.getUTCMonth() ||
      birthday.getUTCDate() !== now.getUTCDate()
    ) {
      throw new BadRequestException(
        'Birthday bonus is only available on your birthday',
      );
    }

    const year = now.getUTCFullYear();
    const award = await this.awardPoints(userId, 'BIRTHDAY_BONUS', userId, {
      idempotencyKey: `BIRTHDAY_BONUS:${userId}:${year}`,
      description: 'Birthday bonus',
    });

    return {
      awarded: award.awarded,
      pointsEarned: award.transaction?.points ?? 0,
      currentPoints: award.transaction?.balanceAfter ?? null,
      message: award.awarded
        ? 'Birthday bonus points added.'
        : 'Birthday bonus already claimed this year.',
    };
  }

  async createRedemptionCode(userId: string, dto: CreateRedemptionCodeDto) {
    await this.rewardsRepository.refundExpiredPendingRedemptions(userId);
    const pointsSpent = dto.amount * 100;
    const account = await this.rewardsRepository.ensureLoyaltyAccount(userId);
    const loyalty = this.getLoyaltyProgressForPoints(
      account.availablePoints,
      account.lifetimePoints,
      account.redeemedPoints,
    );

    if (account.availablePoints < pointsSpent) {
      throw new BadRequestException(
        `Not enough points. ${pointsSpent} points required for $${dto.amount} credit.`,
      );
    }

    if (dto.amount > MAX_REDEEM_PER_VISIT) {
      throw new BadRequestException(
        `Maximum redemption per visit is $${MAX_REDEEM_PER_VISIT}.`,
      );
    }

    if (dto.amount > loyalty.availableCreditAmount) {
      throw new BadRequestException(
        `Redeem amount exceeds available credit. You can redeem up to $${loyalty.availableCreditAmount} now.`,
      );
    }

    if (dto.foodTruckId) {
      const foodTruck = await this.rewardsRepository.findFoodTruckById(
        dto.foodTruckId,
      );

      if (!foodTruck || foodTruck.deletedAt) {
        throw new NotFoundException('Food truck not found');
      }

      if (
        foodTruck.status !== 'ACTIVE' ||
        foodTruck.vendor.deletedAt ||
        foodTruck.vendor.status !== 'APPROVED' ||
        !foodTruck.vendor.isVerified
      ) {
        throw new ForbiddenException('Food truck is not available for redemption');
      }
    }

    const backupCode = Math.floor(100000 + Math.random() * 900000).toString();
    const redemptionToken = `rdm_${backupCode}_${Date.now().toString(36)}`;
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    const redemption = await this.rewardsRepository.createRedemptionCode({
      userId,
      amount: dto.amount,
      pointsSpent,
      backupCode,
      redemptionToken,
      expiresAt,
      foodTruckId: dto.foodTruckId,
    });

    return {
      redemptionId: redemption.id,
      redemptionToken,
      backupCode,
      amount: dto.amount,
      pointsSpent,
      expiresAt,
      status: 'PENDING',
      message: `Show this screen to staff or provide 6-digit backup code: ${backupCode}`,
    };
  }

  async confirmVendorRedemption(
    vendorUserId: string,
    dto: VendorConfirmRedemptionDto,
  ) {
    const vendor =
      await this.rewardsRepository.findVendorByUserId(vendorUserId);

    if (!vendor || vendor.deletedAt) {
      throw new ForbiddenException(
        'Vendor profile is required to confirm redemptions',
      );
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    const tokenOrCode = dto.redemptionToken?.trim() ?? dto.manualCode?.trim();

    if (!tokenOrCode) {
      throw new BadRequestException(
        'Either redemptionToken or manualCode must be provided',
      );
    }

    const redemption =
      await this.rewardsRepository.findPendingRedemptionByTokenOrCode(
        tokenOrCode,
      );

    if (!redemption) {
      throw new NotFoundException('Invalid or expired redemption code');
    }

    if (redemption.foodTruckId) {
      const redemptionTruck = await this.rewardsRepository.findFoodTruckById(
        redemption.foodTruckId,
      );

      if (
        !redemptionTruck ||
        redemptionTruck.deletedAt ||
        redemptionTruck.vendorId !== vendor.id
      ) {
        throw new BadRequestException(
          'This redemption code was generated for another food truck',
        );
      }
    }

    const completed = await this.rewardsRepository.completeVendorRedemption(
      redemption.id,
      vendor.id,
    );

    if (!completed) {
      throw new BadRequestException(
        'Redemption code has already been used or is no longer pending',
      );
    }

    const customerName =
      (completed.user.profile?.displayName ??
        `${completed.user.profile?.firstName ?? ''} ${completed.user.profile?.lastName ?? ''}`.trim()) ||
      'Customer';

    const remainingProgress = this.getLoyaltyProgressForPoints(
      completed.user.loyaltyAccount?.availablePoints ?? 0,
      completed.user.loyaltyAccount?.lifetimePoints ?? 0,
      completed.user.loyaltyAccount?.redeemedPoints ?? 0,
    );
    const remainingCredit =
      remainingProgress.availableCreditAmount.toFixed(2);
    const amountApplied = Number(
      completed.rewardValue ?? redemption.rewardValue ?? 0,
    ).toFixed(2);

    await this.notificationsService.notifyReward(
      completed.userId,
      'Credit Redeemed',
      `$${amountApplied} credit applied at vendor.`,
      { redemptionId: completed.id, vendorId: vendor.id },
    );

    return {
      success: true,
      amountApplied: Number(amountApplied),
      customerName,
      remainingCustomerBalance: Number(remainingCredit),
      message: `Redemption Complete. $${amountApplied} credit applied for ${customerName}.`,
    };
  }

  listBadges() {
    return this.rewardsRepository.listBadges();
  }

  getLoyaltyProgressForPoints(
    availablePoints: number,
    lifetimePoints = availablePoints,
    redeemedPoints = 0,
  ) {
    const currentTier = [...LOYALTY_TIERS]
      .reverse()
      .find((tier) => lifetimePoints >= tier.requiredPoints)!;
    const nextTier =
      LOYALTY_TIERS.find(
        (tier) => tier.requiredPoints > lifetimePoints,
      ) ?? null;
    const finalTier = LOYALTY_TIERS[LOYALTY_TIERS.length - 1];
    const redeemableByPoints = Math.floor(availablePoints / POINTS_PER_DOLLAR);
    const availableCreditAmount = Math.min(
      redeemableByPoints,
      currentTier.creditAmount,
    );
    const target = finalTier.requiredPoints;

    return {
      availablePoints,
      lifetimePoints,
      redeemedPoints,
      availableCreditAmount,
      maxRedeemPerVisit: MAX_REDEEM_PER_VISIT,
      currentTier,
      nextTier: nextTier
        ? {
            ...nextTier,
            pointsRemaining: Math.max(
              nextTier.requiredPoints - lifetimePoints,
              0,
            ),
          }
        : null,
      progress: {
        current: lifetimePoints,
        target,
        percentage:
          target === 0
            ? 100
            : Number(Math.min((lifetimePoints / target) * 100, 100).toFixed(2)),
      },
    };
  }

  listMyCustomerBadges(userId: string) {
    return this.rewardsRepository.listUserBadges(userId);
  }

  async listMyVendorBadges(userId: string) {
    const vendor = await this.rewardsRepository.findVendorByUserId(userId);

    if (!vendor || vendor.deletedAt) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    return this.rewardsRepository.listVendorBadges(vendor.id);
  }

  createBadge(dto: CreateBadgeDto) {
    return this.rewardsRepository.createBadge(dto);
  }

  async awardCustomerBadge(userId: string, dto: AwardBadgeDto) {
    await this.ensureUserExists(userId);
    const badge = await this.ensureBadgeExists(dto.badgeId);

    if (!['CUSTOMER', 'BOTH'].includes(badge.ownerType)) {
      throw new BadRequestException('Badge is not available for customers');
    }

    const userBadge = await this.rewardsRepository.awardUserBadge(userId, dto);

    await this.notificationsService.createNotification({
      userId,
      type: 'BADGE',
      title: 'Badge awarded',
      message: `You earned the ${userBadge.badge.name} badge.`,
      metadata: { badgeId: userBadge.badgeId },
    });

    return userBadge;
  }

  async awardVendorBadge(vendorId: string, dto: AwardBadgeDto) {
    const vendor = await this.rewardsRepository.findVendorById(vendorId);

    if (!vendor || vendor.deletedAt) {
      throw new NotFoundException('Vendor not found');
    }

    const badge = await this.ensureBadgeExists(dto.badgeId);

    if (!['VENDOR', 'BOTH'].includes(badge.ownerType)) {
      throw new BadRequestException('Badge is not available for vendors');
    }

    const vendorBadge = await this.rewardsRepository.awardVendorBadge(
      vendorId,
      dto,
    );

    await this.notificationsService.createNotification({
      userId: vendor.userId,
      type: 'BADGE',
      title: 'Vendor badge awarded',
      message: `Your business earned the ${vendorBadge.badge.name} badge.`,
      metadata: { badgeId: vendorBadge.badgeId, vendorId },
    });

    return vendorBadge;
  }

  private async resolvePoints(sourceType: string) {
    const rule = await this.rewardsRepository.findActivePointRule(sourceType);

    if (rule?.rewardValue !== null && rule?.rewardValue !== undefined) {
      return Math.max(0, Math.floor(Number(rule.rewardValue)));
    }

    return DEFAULT_POINT_RULES[sourceType] ?? 0;
  }

  private async getPointsPerAction() {
    const rules = await this.rewardsRepository.listActivePointRules();
    const overridePointsBySourceType = new Map<string, number>();

    for (const rule of rules) {
      if (
        rule.rewardValue !== null &&
        !overridePointsBySourceType.has(rule.triggerType)
      ) {
        overridePointsBySourceType.set(
          rule.triggerType,
          Math.max(0, Math.floor(Number(rule.rewardValue))),
        );
      }
    }

    return POINTS_PER_ACTION.map((pointAction) => ({
      ...pointAction,
      points:
        overridePointsBySourceType.get(pointAction.sourceType) ??
        pointAction.points,
    }));
  }

  private async getRecentActivity(transactions: any[]) {
    const idsByType = transactions.reduce<Record<string, string[]>>(
      (acc, transaction) => {
        if (transaction.sourceType && transaction.sourceId) {
          acc[transaction.sourceType] ??= [];
          acc[transaction.sourceType].push(transaction.sourceId);
        }

        return acc;
      },
      {},
    );

    const [
      checkIns,
      reviews,
      bookings,
      followedTrucks,
      communityRequests,
      redemptions,
    ] = await Promise.all([
      this.rewardsRepository.findCheckInsByIds(idsByType.CHECK_IN ?? []),
      this.rewardsRepository.findReviewsByIds(idsByType.REVIEW ?? []),
      this.rewardsRepository.findBookingsByIds(idsByType.BOOKING ?? []),
      this.rewardsRepository.findFoodTrucksByIds(
        idsByType.FOLLOW_TRUCK ?? [],
      ),
      this.rewardsRepository.findCommunityRequestsByIds(
        idsByType.COMMUNITY_POST ?? [],
      ),
      this.rewardsRepository.findRewardRedemptionsByIds([
        ...(idsByType.CREDIT_REDEMPTION_CODE ?? []),
        ...(idsByType.EXPIRED_CREDIT_REDEMPTION_REFUND ?? []),
      ]),
    ]);

    const checkInById = new Map<string, any>(
      checkIns.map((item): [string, any] => [item.id, item]),
    );
    const reviewById = new Map<string, any>(
      reviews.map((item): [string, any] => [item.id, item]),
    );
    const bookingById = new Map<string, any>(
      bookings.map((item): [string, any] => [item.id, item]),
    );
    const followedTruckById = new Map<string, any>(
      followedTrucks.map((item): [string, any] => [item.id, item]),
    );
    const communityRequestById = new Map<string, any>(
      communityRequests.map((item): [string, any] => [item.id, item]),
    );
    const redemptionById = new Map<string, any>(
      redemptions.map((item): [string, any] => [item.id, item]),
    );
    const redemptionTruckIds = [
      ...new Set(
        redemptions
          .map((redemption) => redemption.foodTruckId)
          .filter(Boolean) as string[],
      ),
    ];
    const redemptionTrucks = await this.rewardsRepository.findFoodTrucksByIds(
      redemptionTruckIds,
    );
    const redemptionTruckById = new Map<string, any>(
      redemptionTrucks.map((item): [string, any] => [item.id, item]),
    );

    return transactions.map((transaction) => {
      const context = this.getActivityContext(transaction, {
        checkInById,
        reviewById,
        bookingById,
        followedTruckById,
        communityRequestById,
        redemptionById,
        redemptionTruckById,
      });

      return this.toRecentActivity(transaction, context);
    });
  }

  private getActivityContext(
    transaction: any,
    maps: {
      checkInById: Map<string, any>;
      reviewById: Map<string, any>;
      bookingById: Map<string, any>;
      followedTruckById: Map<string, any>;
      communityRequestById: Map<string, any>;
      redemptionById: Map<string, any>;
      redemptionTruckById: Map<string, any>;
    },
  ) {
    const sourceId = transaction.sourceId;

    if (!sourceId) {
      return undefined;
    }

    if (transaction.sourceType === 'CHECK_IN') {
      const checkIn = maps.checkInById.get(sourceId);
      return checkIn
        ? {
            title: checkIn.foodTruck.name,
            subtitle: checkIn.foodTruck.currentAddress
              ? `Checked in at ${checkIn.foodTruck.currentAddress}`
              : 'Checked in',
          }
        : undefined;
    }

    if (transaction.sourceType === 'REVIEW') {
      const review = maps.reviewById.get(sourceId);
      return review
        ? {
            title: review.foodTruck.name,
            subtitle: `Reviewed with ${review.rating} stars`,
          }
        : undefined;
    }

    if (transaction.sourceType === 'BOOKING') {
      const booking = maps.bookingById.get(sourceId);
      return booking
        ? {
            title: booking.foodTruck.name,
            subtitle: booking.eventName
              ? `Booked for ${booking.eventName}`
              : `Booked for ${booking.startsAt.toISOString().slice(0, 10)}`,
          }
        : undefined;
    }

    if (transaction.sourceType === 'FOLLOW_TRUCK') {
      const truck = maps.followedTruckById.get(sourceId);
      return truck
        ? {
            title: truck.name,
            subtitle: 'Followed a food truck',
          }
        : undefined;
    }

    if (transaction.sourceType === 'COMMUNITY_POST') {
      const request = maps.communityRequestById.get(sourceId);
      return request
        ? {
            title: request.title,
            subtitle: request.address ?? 'Community post',
          }
        : undefined;
    }

    if (
      ['CREDIT_REDEMPTION_CODE', 'EXPIRED_CREDIT_REDEMPTION_REFUND'].includes(
        transaction.sourceType,
      )
    ) {
      const redemption = maps.redemptionById.get(sourceId);
      const truck = redemption?.foodTruckId
        ? maps.redemptionTruckById.get(redemption.foodTruckId)
        : null;

      return {
        title: truck?.name ?? this.activityTitle(transaction.sourceType),
        subtitle:
          transaction.sourceType === 'EXPIRED_CREDIT_REDEMPTION_REFUND'
            ? 'Expired credit was refunded'
            : `Credit redemption for $${Number(redemption?.rewardValue ?? 0).toFixed(2)}`,
      };
    }

    return undefined;
  }

  private toRecentActivity(
    transaction: any,
    context?: { title?: string; subtitle?: string },
  ) {
    const sourceType = transaction.sourceType ?? transaction.transactionType;
    const points = Number(transaction.points ?? 0);
    const isEarn = points > 0;

    return {
      id: transaction.id,
      type: sourceType,
      title: context?.title ?? this.activityTitle(sourceType),
      subtitle:
        context?.subtitle ??
        transaction.description ??
        (isEarn ? 'Points earned' : 'Credit redeemed'),
      points,
      createdAt: transaction.createdAt,
      balanceAfter: transaction.balanceAfter,
    };
  }

  private activityTitle(sourceType?: string) {
    const titles: Record<string, string> = {
      CHECK_IN: 'QR code check-in',
      REVIEW: 'Verified review',
      FOLLOW_TRUCK: 'Followed a food truck',
      BOOKING: 'Booking reward',
      COMMUNITY_POST: 'Community post',
      REFERRAL_CUSTOMER: 'Friend referral',
      REFERRAL_VENDOR: 'Vendor referral',
      DAILY_STREAK: 'Daily app streak',
      PROFILE_COMPLETION: 'Profile completed',
      BIRTHDAY_BONUS: 'Birthday bonus',
      CREDIT_REDEMPTION_CODE: 'Credit redeemed',
      REWARD_REDEMPTION: 'Reward redeemed',
    };

    return sourceType ? (titles[sourceType] ?? sourceType) : 'Reward activity';
  }

  private async ensureUserExists(userId: string) {
    const user = await this.rewardsRepository.findUserById(userId);

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensureRewardRuleExists(rewardRuleId: string) {
    const rewardRule =
      await this.rewardsRepository.findRewardRuleById(rewardRuleId);

    if (!rewardRule) {
      throw new NotFoundException('Reward rule not found');
    }

    return rewardRule;
  }

  private async ensureBadgeExists(badgeId: string) {
    const badge = await this.rewardsRepository.findBadgeById(badgeId);

    if (!badge || !badge.isActive) {
      throw new NotFoundException('Badge not found');
    }

    return badge;
  }

  private validateRuleWindow(startsAt?: string, endsAt?: string) {
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }
}
