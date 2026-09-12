import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { RedeemPromotionDto } from './dto/redeem-promotion.dto';
import { PromotionsService } from './promotions.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const unauthorizedExample = errorExample(401, 'Unauthorized', 'Unauthorized');
const forbiddenRoleExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const vendorApprovalErrorExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const promotionExample = {
  id: 'promotion-id',
  foodTruckId: 'food-truck-id',
  title: '20% OFF Summer Special',
  description: 'Get 20% off your entire order when you spend $25 or more!',
  type: 'PERCENTAGE',
  value: 20,
  couponCode: 'SUMMER20',
  minimumSpend: 25,
  maximumDiscount: 10,
  isFollowerOnly: false,
  usageLimit: 100,
  startsAt: '2026-09-08T00:00:00.000Z',
  endsAt: '2026-09-30T23:59:59.000Z',
  isActive: true,
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  foodTruck: {
    id: 'food-truck-id',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
    operatingStatus: 'OPEN',
  },
  _count: {
    redemptions: 12,
  },
};

const promotionRedemptionExample = {
  id: 'redemption-id',
  promotionId: 'promotion-id',
  userId: 'customer-user-id',
  bookingId: null,
  checkInId: 'check-in-id',
  discountAmount: 5,
  redeemedAt: '2026-09-08T06:10:00.000Z',
  promotion: {
    id: 'promotion-id',
    title: '20% OFF Summer Special',
    type: 'PERCENTAGE',
    value: 20,
    foodTruck: {
      id: 'food-truck-id',
      name: 'Taco Paradise',
      slug: 'taco-paradise',
    },
  },
};

const promotionAnalyticsExample = {
  promotion: {
    id: 'promotion-id',
    title: '20% OFF Summer Special',
    type: 'PERCENTAGE',
    value: 20,
    isFollowerOnly: false,
    usageLimit: 100,
    startsAt: '2026-09-08T00:00:00.000Z',
    endsAt: '2026-09-30T23:59:59.000Z',
    isActive: true,
  },
  redemptionCount: 12,
  totalDiscountAmount: 60,
  latestRedemptions: [
    {
      id: 'redemption-id',
      promotionId: 'promotion-id',
      userId: 'customer-user-id',
      bookingId: null,
      checkInId: 'check-in-id',
      discountAmount: 5,
      redeemedAt: '2026-09-08T06:10:00.000Z',
      user: {
        id: 'customer-user-id',
        profile: {
          displayName: 'Alex Rivera',
          avatarUrl: 'https://cdn.bitedrop.com/users/alex.jpg',
        },
      },
    },
  ],
  dailyRedemptions: [
    {
      day: '2026-09-08T00:00:00.000Z',
      redemptionCount: 12,
    },
  ],
  remainingRedemptions: 88,
};

@ApiTags('Promotions')
@Controller('api/v1/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @ApiOperation({
    summary: 'Create a new promotion discount for a food truck (Vendor)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Promotion created successfully.',
    schema: { example: promotionExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Request body validation failed, date range is invalid, or percentage value is over 100.',
    schema: {
      example: errorExample(
        400,
        'Percentage promotion value cannot exceed 100',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing/not approved, or food truck belongs to another vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post()
  createPromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePromotionDto,
  ) {
    return this.promotionsService.createPromotion(user.sub, dto);
  }

  @ApiOperation({ summary: 'List active promotions for a food truck' })
  @ApiResponse({
    status: 200,
    description: 'Food truck promotions returned successfully.',
    schema: { example: [promotionExample] },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be greater than 100'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Food truck vendor is not approved/verified.',
    schema: {
      example: errorExample(
        403,
        'Food truck promotions are not available',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @Get('food-trucks/:foodTruckId')
  listFoodTruckPromotions(
    @Param('foodTruckId') foodTruckId: string,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.listFoodTruckPromotions(foodTruckId, query);
  }

  @ApiOperation({ summary: 'Redeem a promotion discount (Customer)' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Promotion redeemed successfully.',
    schema: { example: promotionRedemptionExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed or promotion is not active.',
    schema: {
      example: errorExample(400, 'Promotion is not active', 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Promotion is not available or is only available to followers.',
    schema: {
      example: errorExample(
        403,
        'Promotion is only available to followers',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion was not found.',
    schema: {
      example: errorExample(404, 'Promotion not found', 'Not Found'),
    },
  })
  @ApiResponse({
    status: 409,
    description:
      'Promotion was already redeemed or redemption limit has been reached.',
    schema: {
      example: errorExample(409, 'Promotion already redeemed', 'Conflict'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post(':promotionId/redeem')
  redeemPromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('promotionId') promotionId: string,
    @Body() dto: RedeemPromotionDto,
  ) {
    return this.promotionsService.redeemPromotion(user.sub, promotionId, dto);
  }

  @ApiOperation({
    summary: 'Get promotion redemption performance analytics (Vendor)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Promotion analytics returned successfully.',
    schema: { example: promotionAnalyticsExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'User is not a vendor, vendor profile is missing/not approved, or promotion belongs to another vendor.',
    schema: {
      example: errorExample(
        403,
        'Promotion does not belong to this vendor',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Promotion was not found.',
    schema: {
      example: errorExample(404, 'Promotion not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get(':promotionId/analytics')
  getPromotionAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('promotionId') promotionId: string,
  ) {
    return this.promotionsService.getPromotionAnalytics(user.sub, promotionId);
  }
}
