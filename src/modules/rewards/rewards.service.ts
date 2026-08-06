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
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { UpdateRewardRuleDto } from './dto/update-reward-rule.dto';
import { RewardsRepository } from './rewards.repository';

const DEFAULT_POINT_RULES: Record<string, number> = {
  FOLLOW_TRUCK: 5,
  CHECK_IN: 10,
  REVIEW: 20,
  REFERRAL_CUSTOMER: 50,
  REFERRAL_VENDOR: 100,
  BOOKING: 25,
};

@Injectable()
export class RewardsService {
  constructor(
    private readonly rewardsRepository: RewardsRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  getMyLoyaltyAccount(userId: string) {
    return this.rewardsRepository.ensureLoyaltyAccount(userId);
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
      description: options.description ?? `Awarded ${points} points for ${sourceType}`,
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

    const redemption = await this.rewardsRepository.redeemReward(userId, rewardRule);

    await this.notificationsService.notifyReward(
      userId,
      'Reward redeemed',
      `You redeemed ${rewardRule.name}.`,
      { redemptionId: redemption.id, rewardRuleId: rewardRule.id },
    );

    return redemption;
  }

  listBadges() {
    return this.rewardsRepository.listBadges();
  }

  listMyCustomerBadges(userId: string) {
    return this.rewardsRepository.listUserBadges(userId);
  }

  async listMyVendorBadges(userId: string) {
    const vendor = await this.rewardsRepository.findVendorByUserId(userId);

    if (!vendor || vendor.deletedAt) {
      throw new ForbiddenException('Vendor profile is required');
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

  private async ensureUserExists(userId: string) {
    const user = await this.rewardsRepository.findUserById(userId);

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
  }

  private async ensureRewardRuleExists(rewardRuleId: string) {
    const rewardRule = await this.rewardsRepository.findRewardRuleById(
      rewardRuleId,
    );

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
