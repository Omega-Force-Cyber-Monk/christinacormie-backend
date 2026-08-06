import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { RedeemPromotionDto } from './dto/redeem-promotion.dto';

@Injectable()
export class PromotionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        vendorId: true,
        deletedAt: true,
      },
    });
  }

  createPromotion(dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        foodTruckId: dto.foodTruckId,
        title: dto.title,
        description: dto.description,
        type: dto.type as any,
        value: dto.value,
        couponCode: dto.couponCode,
        minimumSpend: dto.minimumSpend,
        maximumDiscount: dto.maximumDiscount,
        isFollowerOnly: dto.isFollowerOnly ?? false,
        usageLimit: dto.usageLimit,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        isActive: dto.isActive ?? true,
      },
      include: this.promotionInclude(),
    });
  }

  findPromotionById(promotionId: string) {
    return this.prisma.promotion.findUnique({
      where: { id: promotionId },
      include: {
        foodTruck: {
          select: {
            id: true,
            vendorId: true,
            name: true,
            slug: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  listFoodTruckPromotions(foodTruckId: string, dto: PromotionQueryDto) {
    const now = new Date();
    const activeOnly = dto.activeOnly !== false;

    return this.prisma.promotion.findMany({
      where: {
        foodTruckId,
        ...(activeOnly
          ? {
              isActive: true,
              startsAt: { lte: now },
              endsAt: { gte: now },
            }
          : {}),
      },
      orderBy: { startsAt: 'desc' },
      take: dto.limit ?? 50,
      include: this.promotionInclude(),
    });
  }

  findFollow(userId: string, foodTruckId: string) {
    return this.prisma.foodTruckFollow.findUnique({
      where: {
        userId_foodTruckId: {
          userId,
          foodTruckId,
        },
      },
      select: { id: true },
    });
  }

  findUserRedemption(promotionId: string, userId: string) {
    return this.prisma.promotionRedemption.findFirst({
      where: {
        promotionId,
        userId,
      },
    });
  }

  countRedemptions(promotionId: string) {
    return this.prisma.promotionRedemption.count({
      where: { promotionId },
    });
  }

  createRedemption(
    promotionId: string,
    userId: string,
    dto: RedeemPromotionDto,
  ) {
    return this.prisma.promotionRedemption.create({
      data: {
        promotionId,
        userId,
        bookingId: dto.bookingId,
        checkInId: dto.checkInId,
        discountAmount: dto.discountAmount,
      },
      include: {
        promotion: {
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            foodTruck: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });
  }

  async getAnalytics(promotionId: string) {
    const [redemptionCount, discountAggregate, latestRedemptions] =
      await this.prisma.$transaction([
        this.prisma.promotionRedemption.count({
          where: { promotionId },
        }),
        this.prisma.promotionRedemption.aggregate({
          where: { promotionId },
          _sum: { discountAmount: true },
        }),
        this.prisma.promotionRedemption.findMany({
          where: { promotionId },
          orderBy: { redeemedAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                profile: {
                  select: {
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const dailyRows = await this.prisma.$queryRaw<
      Array<{ day: Date; redemptionCount: bigint }>
    >`
      SELECT
        DATE_TRUNC('day', redeemed_at) AS day,
        COUNT(*) AS "redemptionCount"
      FROM promotion_redemptions
      WHERE promotion_id = ${promotionId}::uuid
      GROUP BY day
      ORDER BY day DESC
      LIMIT 30
    `;

    return {
      redemptionCount,
      totalDiscountAmount: discountAggregate._sum.discountAmount ?? 0,
      latestRedemptions,
      dailyRedemptions: dailyRows.map((row) => ({
        day: row.day,
        redemptionCount: Number(row.redemptionCount),
      })),
    };
  }

  private promotionInclude() {
    return {
      foodTruck: {
        select: {
          id: true,
          name: true,
          slug: true,
          profileImageUrl: true,
          operatingStatus: true,
        },
      },
      _count: {
        select: {
          redemptions: true,
        },
      },
    };
  }
}
