import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { AwardBadgeDto } from './dto/award-badge.dto';
import { AwardPointsDto } from './dto/award-points.dto';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { CreateRedemptionCodeDto } from './dto/create-redemption-code.dto';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { UpdateRewardRuleDto } from './dto/update-reward-rule.dto';
import { VendorConfirmRedemptionDto } from './dto/vendor-confirm-redemption.dto';
import { RewardsService } from './rewards.service';

@ApiTags('Rewards & Badges')
@ApiBearerAuth()
@Controller()
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @ApiOperation({ summary: 'Get my loyalty points account and history' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/me/loyalty')
  getMyLoyaltyAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getMyLoyaltyAccount(user.sub);
  }

  @ApiOperation({ summary: 'List available reward rules' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/rules')
  listRewardRules() {
    return this.rewardsService.listRewardRules();
  }

  @ApiOperation({ summary: 'Redeem loyalty points for a reward' })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/redeem')
  redeemReward(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.rewardsService.redeemReward(user.sub, dto);
  }

  @ApiOperation({ summary: 'Request a credit redemption code & 6-digit backup code (Customer)' })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/me/redemption-codes')
  createRedemptionCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRedemptionCodeDto,
  ) {
    return this.rewardsService.createRedemptionCode(user.sub, dto);
  }

  @ApiOperation({ summary: 'Confirm customer credit redemption via QR token or 6-digit backup code (Vendor)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/redemptions/confirm')
  confirmVendorRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VendorConfirmRedemptionDto,
  ) {
    return this.rewardsService.confirmVendorRedemption(user.sub, dto);
  }

  @ApiOperation({ summary: 'List all platform badges' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/badges')
  listBadges() {
    return this.rewardsService.listBadges();
  }

  @ApiOperation({ summary: 'List my earned customer badges' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/me/badges')
  listMyCustomerBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyCustomerBadges(user.sub);
  }

  @ApiOperation({ summary: 'List my earned vendor badges' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('api/v1/rewards/me/vendor-badges')
  listMyVendorBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyVendorBadges(user.sub);
  }

  @ApiOperation({ summary: 'Create a new reward rule (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/rewards/rules')
  createRewardRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRewardRuleDto,
  ) {
    return this.rewardsService.createRewardRule(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update an existing reward rule (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/rewards/rules/:rewardRuleId')
  updateRewardRule(
    @Param('rewardRuleId') rewardRuleId: string,
    @Body() dto: UpdateRewardRuleDto,
  ) {
    return this.rewardsService.updateRewardRule(rewardRuleId, dto);
  }

  @ApiOperation({ summary: 'Manually award loyalty points to a user (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/rewards/points')
  awardPoints(@Body() dto: AwardPointsDto) {
    return this.rewardsService.awardPointsFromDto(dto);
  }

  @ApiOperation({ summary: 'Create a new platform badge (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/badges')
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.rewardsService.createBadge(dto);
  }

  @ApiOperation({ summary: 'Manually award a badge to a customer (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/users/:userId/badges')
  awardCustomerBadge(
    @Param('userId') userId: string,
    @Body() dto: AwardBadgeDto,
  ) {
    return this.rewardsService.awardCustomerBadge(userId, dto);
  }

  @ApiOperation({ summary: 'Manually award a badge to a vendor (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/vendors/:vendorId/badges')
  awardVendorBadge(
    @Param('vendorId') vendorId: string,
    @Body() dto: AwardBadgeDto,
  ) {
    return this.rewardsService.awardVendorBadge(vendorId, dto);
  }
}
