import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';

@Injectable()
export class ReferralsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
  }

  findCodeByCode(code: string) {
    return this.prisma.referralCode.findUnique({
      where: { code },
    });
  }

  findReferralById(referralId: string) {
    return this.prisma.referral.findUnique({
      where: { id: referralId },
      include: {
        referralCode: true,
        rewards: true,
      },
    });
  }

  findReferralForReferredUser(userId: string) {
    return this.prisma.referral.findUnique({
      where: { referredUserId: userId },
    });
  }

  listMyCodes(userId: string) {
    return this.prisma.referralCode.findMany({
      where: { ownerUserId: userId },
      orderBy: { id: 'desc' },
      include: {
        referrals: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { rewards: true },
        },
      },
    });
  }

  createCode(userId: string, dto: CreateReferralCodeDto) {
    return this.prisma.referralCode.create({
      data: {
        ownerUserId: userId,
        code: dto.code?.trim().toUpperCase() ?? this.createCodeValue(),
        programType: dto.programType as any,
        maximumUses: dto.maximumUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async applyCode(referredUserId: string, referralCode: any) {
    return this.prisma.$transaction(async (tx) => {
      const referral = await tx.referral.create({
        data: {
          referralCodeId: referralCode.id,
          referrerUserId: referralCode.ownerUserId,
          referredUserId,
          programType: referralCode.programType,
        },
        include: { referralCode: true },
      });

      await tx.referralCode.update({
        where: { id: referralCode.id },
        data: { usageCount: { increment: 1 } },
      });

      return referral;
    });
  }

  qualifyReferral(referralId: string) {
    return this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'QUALIFIED',
        qualifiedAt: new Date(),
      },
      include: {
        referralCode: true,
        rewards: true,
      },
    });
  }

  markRewarded(referralId: string) {
    return this.prisma.referral.update({
      where: { id: referralId },
      data: {
        status: 'REWARDED',
        rewardedAt: new Date(),
      },
      include: {
        referralCode: true,
        rewards: true,
      },
    });
  }

  findReferralReward(referralId: string, beneficiaryUserId: string) {
    return this.prisma.referralReward.findFirst({
      where: { referralId, beneficiaryUserId },
    });
  }

  createIssuedReward(data: {
    referralId: string;
    beneficiaryUserId: string;
    points: number;
  }) {
    return this.prisma.referralReward.create({
      data: {
        referralId: data.referralId,
        beneficiaryUserId: data.beneficiaryUserId,
        rewardType: 'POINTS',
        points: data.points,
        rewardValue: data.points,
        status: 'ISSUED',
        issuedAt: new Date(),
      },
    });
  }

  private createCodeValue() {
    return `BD${randomBytes(5).toString('hex').toUpperCase()}`;
  }
}
