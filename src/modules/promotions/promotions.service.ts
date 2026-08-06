import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { RedeemPromotionDto } from './dto/redeem-promotion.dto';
import { PromotionsRepository } from './promotions.repository';

@Injectable()
export class PromotionsService {
  constructor(private readonly promotionsRepository: PromotionsRepository) {}

  async createPromotion(userId: string, dto: CreatePromotionDto) {
    await this.ensureOwnFoodTruck(userId, dto.foodTruckId);
    this.validatePromotionWindow(dto.startsAt, dto.endsAt);

    if (dto.type === 'PERCENTAGE' && dto.value !== undefined && dto.value > 100) {
      throw new BadRequestException('Percentage promotion value cannot exceed 100');
    }

    return this.promotionsRepository.createPromotion(dto);
  }

  async listFoodTruckPromotions(foodTruckId: string, dto: PromotionQueryDto) {
    await this.ensureFoodTruckExists(foodTruckId);
    return this.promotionsRepository.listFoodTruckPromotions(foodTruckId, dto);
  }

  async redeemPromotion(
    userId: string,
    promotionId: string,
    dto: RedeemPromotionDto,
  ) {
    const promotion = await this.promotionsRepository.findPromotionById(
      promotionId,
    );

    if (!promotion || promotion.foodTruck.deletedAt) {
      throw new NotFoundException('Promotion not found');
    }

    const now = new Date();

    if (!promotion.isActive || promotion.startsAt > now || promotion.endsAt < now) {
      throw new BadRequestException('Promotion is not active');
    }

    const existingRedemption =
      await this.promotionsRepository.findUserRedemption(promotionId, userId);

    if (existingRedemption) {
      throw new ConflictException('Promotion already redeemed');
    }

    if (promotion.isFollowerOnly) {
      const follow = await this.promotionsRepository.findFollow(
        userId,
        promotion.foodTruckId,
      );

      if (!follow) {
        throw new ForbiddenException('Promotion is only available to followers');
      }
    }

    if (promotion.usageLimit !== null) {
      const redemptionCount =
        await this.promotionsRepository.countRedemptions(promotionId);

      if (redemptionCount >= promotion.usageLimit) {
        throw new ConflictException('Promotion redemption limit reached');
      }
    }

    try {
      return await this.promotionsRepository.createRedemption(
        promotionId,
        userId,
        dto,
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Promotion already redeemed');
      }

      throw error;
    }
  }

  async getPromotionAnalytics(userId: string, promotionId: string) {
    const promotion = await this.ensureOwnPromotion(userId, promotionId);
    const analytics = await this.promotionsRepository.getAnalytics(promotionId);

    return {
      promotion: {
        id: promotion.id,
        title: promotion.title,
        type: promotion.type,
        value: promotion.value,
        isFollowerOnly: promotion.isFollowerOnly,
        usageLimit: promotion.usageLimit,
        startsAt: promotion.startsAt,
        endsAt: promotion.endsAt,
        isActive: promotion.isActive,
      },
      ...analytics,
      remainingRedemptions:
        promotion.usageLimit === null
          ? null
          : Math.max(promotion.usageLimit - analytics.redemptionCount, 0),
    };
  }

  private validatePromotionWindow(startsAt: string, endsAt: string) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);

    if (start >= end) {
      throw new BadRequestException('startsAt must be before endsAt');
    }
  }

  private async ensureFoodTruckExists(foodTruckId: string) {
    const foodTruck = await this.promotionsRepository.findFoodTruckById(
      foodTruckId,
    );

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    return foodTruck;
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.promotionsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    const foodTruck = await this.ensureFoodTruckExists(foodTruckId);

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }

    return foodTruck;
  }

  private async ensureOwnPromotion(userId: string, promotionId: string) {
    const vendor = await this.promotionsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    const promotion = await this.promotionsRepository.findPromotionById(
      promotionId,
    );

    if (!promotion || promotion.foodTruck.deletedAt) {
      throw new NotFoundException('Promotion not found');
    }

    if (promotion.foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Promotion does not belong to this vendor');
    }

    return promotion;
  }
}
