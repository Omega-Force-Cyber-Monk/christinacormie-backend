import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { UpdateRewardRuleDto } from './dto/update-reward-rule.dto';

@Injectable()
export class RewardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
  }

  findVendorById(vendorId: string) {
    return this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, userId: true, deletedAt: true },
    });
  }

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true, userId: true, deletedAt: true },
    });
  }

  ensureLoyaltyAccount(userId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { userId },
      create: { userId },
      update: { updatedAt: new Date() },
      include: this.accountInclude(),
    });
  }

  findActivePointRule(triggerType: string) {
    const now = new Date();

    return this.prisma.rewardRule.findFirst({
      where: {
        triggerType,
        rewardType: 'POINTS',
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { startsAt: 'desc' },
    });
  }

  findRewardRuleById(rewardRuleId: string) {
    return this.prisma.rewardRule.findUnique({
      where: { id: rewardRuleId },
    });
  }

  listActiveRewardRules() {
    const now = new Date();

    return this.prisma.rewardRule.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { name: 'asc' },
    });
  }

  createRewardRule(adminUserId: string, dto: CreateRewardRuleDto) {
    return this.prisma.rewardRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        rewardType: dto.rewardType as any,
        pointsRequired: dto.pointsRequired,
        rewardValue: dto.rewardValue,
        configuration: dto.configuration as any,
        maximumUsesPerUser: dto.maximumUsesPerUser,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        isActive: dto.isActive ?? true,
        createdById: adminUserId,
      },
    });
  }

  updateRewardRule(rewardRuleId: string, dto: UpdateRewardRuleDto) {
    return this.prisma.rewardRule.update({
      where: { id: rewardRuleId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
        ...(dto.rewardType !== undefined ? { rewardType: dto.rewardType as any } : {}),
        ...(dto.pointsRequired !== undefined
          ? { pointsRequired: dto.pointsRequired }
          : {}),
        ...(dto.rewardValue !== undefined ? { rewardValue: dto.rewardValue } : {}),
        ...(dto.configuration !== undefined
          ? { configuration: dto.configuration as any }
          : {}),
        ...(dto.maximumUsesPerUser !== undefined
          ? { maximumUsesPerUser: dto.maximumUsesPerUser }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.endsAt !== undefined
          ? { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async awardPoints(data: {
    userId: string;
    points: number;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    description?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltyTransaction.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });

      if (existing) {
        return { transaction: existing, alreadyAwarded: true };
      }

      const account = await tx.loyaltyAccount.upsert({
        where: { userId: data.userId },
        create: { userId: data.userId },
        update: {},
      });
      const balanceAfter = account.availablePoints + data.points;

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          availablePoints: balanceAfter,
          lifetimePoints: { increment: data.points },
          updatedAt: new Date(),
        },
      });

      const transaction = await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          transactionType: 'EARN',
          points: data.points,
          balanceBefore: account.availablePoints,
          balanceAfter,
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          idempotencyKey: data.idempotencyKey,
          description: data.description,
        },
      });

      return { transaction, alreadyAwarded: false };
    });
  }

  async redeemReward(userId: string, rewardRule: any) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      const pointsRequired = rewardRule.pointsRequired ?? 0;
      const balanceAfter = account.availablePoints - pointsRequired;

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          availablePoints: balanceAfter,
          redeemedPoints: { increment: pointsRequired },
          updatedAt: new Date(),
        },
      });

      const redemption = await tx.rewardRedemption.create({
        data: {
          rewardRuleId: rewardRule.id,
          userId,
          pointsSpent: pointsRequired,
          rewardValue: rewardRule.rewardValue,
          expiresAt: rewardRule.endsAt,
          status: 'COMPLETED',
          usedAt: new Date(),
        },
        include: { rewardRule: true },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          transactionType: 'REDEEM',
          points: -pointsRequired,
          balanceBefore: account.availablePoints,
          balanceAfter,
          sourceType: 'REWARD_REDEMPTION',
          sourceId: redemption.id,
          idempotencyKey: `reward_redemption:${redemption.id}`,
          description: `Redeemed reward: ${rewardRule.name}`,
        },
      });

      return redemption;
    });
  }

  async createRedemptionCode(data: {
    userId: string;
    amount: number;
    pointsSpent: number;
    backupCode: string;
    redemptionToken: string;
    expiresAt: Date;
    foodTruckId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.upsert({
        where: { userId: data.userId },
        create: { userId: data.userId },
        update: {},
      });

      const balanceAfter = account.availablePoints - data.pointsSpent;

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          availablePoints: balanceAfter,
          redeemedPoints: { increment: data.pointsSpent },
          updatedAt: new Date(),
        },
      });

      const redemption = await tx.rewardRedemption.create({
        data: {
          userId: data.userId,
          foodTruckId: data.foodTruckId,
          pointsSpent: data.pointsSpent,
          rewardValue: data.amount,
          backupCode: data.backupCode,
          redemptionToken: data.redemptionToken,
          status: 'PENDING',
          expiresAt: data.expiresAt,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          transactionType: 'REDEEM',
          points: -data.pointsSpent,
          balanceBefore: account.availablePoints,
          balanceAfter,
          sourceType: 'CREDIT_REDEMPTION_CODE',
          sourceId: redemption.id,
          idempotencyKey: `credit_redemption:${redemption.id}`,
          description: `Credit redemption code for $${data.amount.toFixed(2)}`,
        },
      });

      return redemption;
    });
  }

  async findPendingRedemptionByTokenOrCode(tokenOrCode: string) {
    const now = new Date();
    return this.prisma.rewardRedemption.findFirst({
      where: {
        OR: [
          { redemptionToken: tokenOrCode },
          { backupCode: tokenOrCode },
        ],
        status: 'PENDING',
        expiresAt: { gte: now },
      },
      include: {
        user: {
          include: {
            profile: true,
            loyaltyAccount: true,
          },
        },
      },
    });
  }

  async completeVendorRedemption(redemptionId: string, vendorId: string) {
    return this.prisma.rewardRedemption.update({
      where: { id: redemptionId },
      data: {
        status: 'COMPLETED',
        usedAt: new Date(),
        vendorId,
      },
      include: {
        user: {
          include: {
            profile: true,
            loyaltyAccount: true,
          },
        },
      },
    });
  }

  countRewardRedemptions(userId: string, rewardRuleId: string) {
    return this.prisma.rewardRedemption.count({
      where: { userId, rewardRuleId },
    });
  }

  createBadge(dto: CreateBadgeDto) {
    return this.prisma.badge.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        iconUrl: dto.iconUrl,
        ownerType: dto.ownerType as any,
        glowColor: dto.glowColor,
        criteria: dto.criteria as any,
        isActive: dto.isActive ?? true,
      },
    });
  }

  findBadgeById(badgeId: string) {
    return this.prisma.badge.findUnique({
      where: { id: badgeId },
    });
  }

  listBadges() {
    return this.prisma.badge.findMany({
      orderBy: { name: 'asc' },
    });
  }

  listUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId, revokedAt: null },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
  }

  listVendorBadges(vendorId: string) {
    return this.prisma.vendorBadge.findMany({
      where: { vendorId, revokedAt: null },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
  }

  awardUserBadge(userId: string, dto: AwardBadgeDto) {
    return this.prisma.userBadge.upsert({
      where: {
        userId_badgeId: {
          userId,
          badgeId: dto.badgeId,
        },
      },
      create: {
        userId,
        badgeId: dto.badgeId,
        awardedReason: dto.awardedReason,
      },
      update: {
        awardedReason: dto.awardedReason,
        revokedAt: null,
      },
      include: { badge: true },
    });
  }

  awardVendorBadge(vendorId: string, dto: AwardBadgeDto) {
    return this.prisma.vendorBadge.upsert({
      where: {
        vendorId_badgeId: {
          vendorId,
          badgeId: dto.badgeId,
        },
      },
      create: {
        vendorId,
        badgeId: dto.badgeId,
        awardedReason: dto.awardedReason,
      },
      update: {
        awardedReason: dto.awardedReason,
        revokedAt: null,
      },
      include: { badge: true },
    });
  }

  private accountInclude() {
    return {
      transactions: {
        orderBy: { createdAt: 'desc' as const },
        take: 20,
      },
      user: {
        select: {
          userBadges: {
            where: { revokedAt: null },
            include: { badge: true },
            orderBy: { awardedAt: 'desc' as const },
          },
          rewardRedemptions: {
            orderBy: { redeemedAt: 'desc' as const },
            take: 20,
            include: { rewardRule: true },
          },
        },
      },
    };
  }
}
