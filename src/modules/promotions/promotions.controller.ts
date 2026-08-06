import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Promotions')
@Controller('api/v1/promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @ApiOperation({ summary: 'Create a new promotion discount for a food truck (Vendor)' })
  @ApiBearerAuth()
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
  @Get('food-trucks/:foodTruckId')
  listFoodTruckPromotions(
    @Param('foodTruckId') foodTruckId: string,
    @Query() query: PromotionQueryDto,
  ) {
    return this.promotionsService.listFoodTruckPromotions(foodTruckId, query);
  }

  @ApiOperation({ summary: 'Redeem a promotion discount (Customer)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':promotionId/redeem')
  redeemPromotion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('promotionId') promotionId: string,
    @Body() dto: RedeemPromotionDto,
  ) {
    return this.promotionsService.redeemPromotion(user.sub, promotionId, dto);
  }

  @ApiOperation({ summary: 'Get promotion redemption performance analytics (Vendor)' })
  @ApiBearerAuth()
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
