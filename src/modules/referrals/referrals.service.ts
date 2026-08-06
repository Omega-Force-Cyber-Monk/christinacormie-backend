import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { ApplyReferralCodeDto } from './dto/apply-referral-code.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { ReferralsRepository } from './referrals.repository';

@Injectable()
export class ReferralsService {
  constructor(
    private readonly referralsRepository: ReferralsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
  ) {}

  async createMyCode(userId: string, dto: CreateReferralCodeDto) {
    await this.ensureUserExists(userId);

    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('expiresAt must be in the future');
    }

    try {
      return await this.referralsRepository.createCode(userId, dto);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Referral code already exists');
      }

      throw error;
    }
  }

  listMyCodes(userId: string) {
    return this.referralsRepository.listMyCodes(userId);
  }

  async applyCode(userId: string, dto: ApplyReferralCodeDto) {
    await this.ensureUserExists(userId);
    const referralCode = await this.referralsRepository.findCodeByCode(
      dto.code.trim().toUpperCase(),
    );

    if (!referralCode || !referralCode.isActive) {
      throw new NotFoundException('Referral code not found');
    }

    if (referralCode.ownerUserId === userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    if (referralCode.expiresAt && referralCode.expiresAt <= new Date()) {
      throw new BadRequestException('Referral code has expired');
    }

    if (
      referralCode.maximumUses !== null &&
      referralCode.usageCount >= referralCode.maximumUses
    ) {
      throw new BadRequestException('Referral code usage limit reached');
    }

    const existing = await this.referralsRepository.findReferralForReferredUser(
      userId,
    );

    if (existing) {
      throw new ConflictException('User already has a referral');
    }

    try {
      const referral = await this.referralsRepository.applyCode(
        userId,
        referralCode,
      );

      await this.notificationsService.createNotification({
        userId: referral.referrerUserId,
        actorUserId: userId,
        type: 'REFERRAL',
        title: 'Referral code used',
        message: 'Someone used your referral code.',
        metadata: { referralId: referral.id, programType: referral.programType },
      });

      return referral;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('User already has a referral');
      }

      throw error;
    }
  }

  async qualifyReferral(referralId: string) {
    const referral = await this.referralsRepository.findReferralById(referralId);

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    if (referral.status === 'REWARDED') {
      return referral;
    }

    if (['REJECTED', 'EXPIRED'].includes(referral.status)) {
      throw new BadRequestException('Referral cannot be rewarded');
    }

    const qualified =
      referral.status === 'QUALIFIED'
        ? referral
        : await this.referralsRepository.qualifyReferral(referralId);
    const sourceType =
      qualified.programType === 'VENDOR'
        ? 'REFERRAL_VENDOR'
        : 'REFERRAL_CUSTOMER';
    const award = await this.rewardsService.awardPoints(
      qualified.referrerUserId,
      sourceType,
      qualified.id,
      {
        idempotencyKey: `${sourceType}:${qualified.referrerUserId}:${qualified.id}`,
        description: `Referral reward for ${qualified.programType.toLowerCase()} referral`,
      },
    );

    if (award.awarded && award.transaction) {
      const existingReward = await this.referralsRepository.findReferralReward(
        qualified.id,
        qualified.referrerUserId,
      );

      if (!existingReward) {
        await this.referralsRepository.createIssuedReward({
          referralId: qualified.id,
          beneficiaryUserId: qualified.referrerUserId,
          points: award.transaction.points,
        });
      }
    }

    const rewarded = await this.referralsRepository.markRewarded(qualified.id);

    await this.notificationsService.createNotification({
      userId: rewarded.referrerUserId,
      type: 'REFERRAL',
      title: 'Referral qualified',
      message: 'Your referral has qualified for a reward.',
      metadata: { referralId: rewarded.id, programType: rewarded.programType },
    });

    return rewarded;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.referralsRepository.findUserById(userId);

    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
  }
}
