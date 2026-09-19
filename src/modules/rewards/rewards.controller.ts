import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { AwardBadgeDto } from './dto/award-badge.dto';
import { AwardPointsDto } from './dto/award-points.dto';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { CreateRedemptionCodeDto } from './dto/create-redemption-code.dto';
import { CreateRewardRuleDto } from './dto/create-reward-rule.dto';
import { RedeemRewardDto } from './dto/redeem-reward.dto';
import { UpdateRewardRuleDto } from './dto/update-reward-rule.dto';
import { VendorConfirmRedemptionDto } from './dto/vendor-confirm-redemption.dto';
import { RewardsService } from './rewards.service';

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
const forbiddenAdminExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const forbiddenVendorApprovalExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const loyaltyAccountExample = {
  id: 'loyalty-account-id',
  userId: 'customer-user-id',
  availablePoints: 2450,
  lifetimePoints: 2450,
  redeemedPoints: 0,
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  transactions: [
    {
      id: 'transaction-id',
      loyaltyAccountId: 'loyalty-account-id',
      transactionType: 'EARN',
      points: 10,
      balanceBefore: 2440,
      balanceAfter: 2450,
      sourceType: 'CHECK_IN',
      sourceId: 'check-in-id',
      description: 'First-time QR check-in bonus',
      createdAt: '2026-09-08T06:10:00.000Z',
    },
  ],
};

const profileSummaryExample = {
  profile: {
    id: 'customer-user-id',
    name: 'Alex Rivera',
    email: 'customer@example.com',
    avatarUrl: 'https://cdn.bitedrop.com/avatars/alex.jpg',
    level: 3,
  },
  loyalty: {
    availablePoints: 2450,
    lifetimePoints: 2450,
    redeemedPoints: 0,
    availableCreditAmount: 10,
    maxRedeemPerVisit: 5,
    currentTier: {
      slug: 'drop-hunter',
      name: 'Drop Hunter',
      requiredPoints: 2000,
      creditAmount: 10,
      level: 3,
    },
    nextTier: {
      slug: 'bitedrop-legend',
      name: 'BiteDrop Legend',
      requiredPoints: 10000,
      creditAmount: 25,
      level: 4,
      pointsRemaining: 7550,
    },
    progress: {
      current: 2450,
      target: 10000,
      percentage: 24.5,
    },
  },
  tiers: [
    {
      slug: 'foodie',
      name: 'Foodie',
      requiredPoints: 0,
      creditAmount: 0,
      level: 1,
      isCurrent: false,
    },
    {
      slug: 'drop-hunter',
      name: 'Drop Hunter',
      requiredPoints: 2000,
      creditAmount: 10,
      level: 3,
      isCurrent: true,
    },
  ],
  pointsPerAction: [
    { sourceType: 'CHECK_IN', action: 'QR code check-in', points: 10 },
    { sourceType: 'REVIEW', action: 'Leave a verified review', points: 25 },
    { sourceType: 'FOLLOW_TRUCK', action: 'Follow a food truck', points: 5 },
    { sourceType: 'BOOKING', action: 'Make a booking', points: 100 },
  ],
  recentActivity: [
    {
      id: 'transaction-id',
      type: 'CHECK_IN',
      title: 'Taco Paradise',
      subtitle: 'Checked in at Union Square',
      points: 10,
      createdAt: '2026-09-08T06:10:00.000Z',
      balanceAfter: 2450,
    },
  ],
  actions: {
    canRedeem: true,
    canInviteFriends: true,
    canRequestTruck: true,
    canManageSettings: true,
    canOpenSupport: false,
  },
};

const rewardRuleExample = {
  id: 'reward-rule-id',
  name: '$10 Off Next Order',
  description: 'Redeem 500 loyalty points for a $10 discount coupon',
  triggerType: 'LOYALTY_POINTS',
  rewardType: 'DISCOUNT',
  pointsRequired: 500,
  rewardValue: 10,
  configuration: { discountType: 'FIXED_AMOUNT', amount: 10 },
  maximumUsesPerUser: 5,
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-12-31T23:59:59.000Z',
  isActive: true,
};

const rewardRedemptionExample = {
  id: 'reward-redemption-id',
  rewardRuleId: 'reward-rule-id',
  userId: 'customer-user-id',
  pointsSpent: 500,
  rewardValue: 10,
  status: 'COMPLETED',
  usedAt: '2026-09-08T06:10:00.000Z',
  rewardRule: rewardRuleExample,
};

const pointsAwardExample = {
  awarded: true,
  transaction: {
    id: 'transaction-id',
    loyaltyAccountId: 'loyalty-account-id',
    transactionType: 'EARN',
    points: 100,
    balanceBefore: 2450,
    balanceAfter: 2550,
    sourceType: 'MANUAL_BONUS',
    sourceId: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description: 'Customer appreciation bonus points',
    createdAt: '2026-09-08T06:10:00.000Z',
  },
};

const redemptionCodeExample = {
  redemptionId: 'reward-redemption-id',
  redemptionToken: 'rdm_847291_a1b2c3',
  backupCode: '847291',
  amount: 5,
  pointsSpent: 500,
  expiresAt: '2026-09-08T06:25:00.000Z',
  status: 'PENDING',
  message: 'Show this screen to staff or provide 6-digit backup code: 847291',
};

const vendorRedemptionConfirmExample = {
  success: true,
  amountApplied: 5,
  customerName: 'Alex Rivera',
  remainingCustomerBalance: 5,
  message: 'Redemption Complete. $5.00 credit applied for Alex Rivera.',
};

const badgeExample = {
  id: 'badge-id',
  name: 'Super Foodie',
  slug: 'super-foodie',
  description: 'Awarded for checking in at 10 different food trucks',
  iconUrl: 'https://cdn.bitedrop.com/badges/super-foodie.png',
  ownerType: 'CUSTOMER',
  glowColor: '#FFD700',
  criteria: { minCheckIns: 10 },
  isActive: true,
};

const awardedBadgeExample = {
  id: 'user-badge-id',
  userId: 'customer-user-id',
  badgeId: 'badge-id',
  awardedReason: 'Achieved 10 food truck check-ins milestone',
  awardedAt: '2026-09-08T06:10:00.000Z',
  revokedAt: null,
  badge: badgeExample,
};

@ApiTags('Rewards & Badges')
@ApiBearerAuth()
@Controller()
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @ApiOperation({ summary: 'Get my loyalty points account and history' })
  @ApiResponse({
    status: 200,
    description: 'Loyalty account and recent transaction history returned.',
    schema: { example: loyaltyAccountExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/me/loyalty')
  getMyLoyaltyAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getMyLoyaltyAccount(user.sub);
  }

  @ApiOperation({
    summary:
      'Get customer rewards/profile page summary with points, tiers, credit, and recent activity',
  })
  @ApiResponse({
    status: 200,
    description:
      'Rewards profile summary returned for the customer rewards/profile page.',
    schema: { example: profileSummaryExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/me/profile-summary')
  getMyProfileSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.getMyProfileSummary(user.sub);
  }

  @ApiOperation({ summary: 'List available reward rules' })
  @ApiResponse({
    status: 200,
    description: 'Active reward rules returned successfully.',
    schema: { example: [rewardRuleExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/rules')
  listRewardRules() {
    return this.rewardsService.listRewardRules();
  }

  @ApiOperation({ summary: 'Redeem loyalty points for a reward' })
  @ApiResponse({
    status: 201,
    description: 'Reward redeemed successfully.',
    schema: { example: rewardRedemptionExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Reward is inactive, expired, unavailable, limit reached, or customer has insufficient points.',
    schema: {
      example: errorExample(400, 'Not enough loyalty points', 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Reward rule was not found.',
    schema: {
      example: errorExample(404, 'Reward rule not found', 'Not Found'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/redeem')
  redeemReward(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RedeemRewardDto,
  ) {
    return this.rewardsService.redeemReward(user.sub, dto);
  }

  @ApiOperation({ summary: 'Claim daily app streak points once per day' })
  @ApiResponse({
    status: 201,
    description: 'Daily streak processed successfully.',
    schema: {
      example: {
        awarded: true,
        pointsEarned: 5,
        currentPoints: 2455,
        message: 'Daily app streak points added.',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Authenticated user no longer exists.',
    schema: { example: errorExample(404, 'User not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/me/daily-streak')
  claimDailyStreak(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.claimDailyStreak(user.sub);
  }

  @ApiOperation({ summary: 'Claim birthday bonus points once per year' })
  @ApiResponse({
    status: 201,
    description: 'Birthday bonus processed successfully.',
    schema: {
      example: {
        awarded: true,
        pointsEarned: 50,
        currentPoints: 2500,
        message: 'Birthday bonus points added.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Date of birth is missing, today is not the birthday, or yearly bonus already claimed.',
    schema: {
      example: errorExample(
        400,
        'Birthday bonus is only available on your birthday',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/me/birthday-bonus')
  claimBirthdayBonus(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.claimBirthdayBonus(user.sub);
  }

  @ApiOperation({
    summary:
      'Request a credit redemption code & 6-digit backup code (Customer)',
  })
  @ApiResponse({
    status: 201,
    description:
      'Credit redemption code created. Customer should show QR token or backup code to vendor.',
    schema: { example: redemptionCodeExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Customer does not have enough points, redeem amount exceeds credit, or amount exceeds max per visit.',
    schema: {
      example: errorExample(
        400,
        'Maximum redemption per visit is $5.',
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
    description: 'Selected food truck is not available for redemption.',
    schema: {
      example: errorExample(
        403,
        'Food truck is not available for redemption',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Selected food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/rewards/me/redemption-codes')
  createRedemptionCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRedemptionCodeDto,
  ) {
    return this.rewardsService.createRedemptionCode(user.sub, dto);
  }

  @ApiOperation({
    summary:
      'Confirm customer credit redemption via QR token or 6-digit backup code (Vendor)',
  })
  @ApiResponse({
    status: 201,
    description: 'Customer credit redemption confirmed by vendor.',
    schema: { example: vendorRedemptionConfirmExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Token/code is missing, code is for another food truck, or code was already used.',
    schema: {
      example: errorExample(
        400,
        'Either redemptionToken or manualCode must be provided',
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
      'Vendor profile is missing, vendor is not approved, or vendor is not accepting credits.',
    schema: {
      examples: {
        vendorNotApproved: {
          summary: 'Vendor not approved',
          value: forbiddenVendorApprovalExample,
        },
        creditAcceptanceDisabled: {
          summary: 'Vendor credit acceptance disabled',
          value: errorExample(
            403,
            'This vendor is not accepting BiteDrop Credits right now',
            'Forbidden',
          ),
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Redemption token/manual code is invalid or expired.',
    schema: {
      example: errorExample(
        404,
        'Invalid or expired redemption code',
        'Not Found',
      ),
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR, UserRole.VENDOR_STAFF)
  @Post('api/v1/vendors/me/redemptions/confirm')
  confirmVendorRedemption(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VendorConfirmRedemptionDto,
  ) {
    return this.rewardsService.confirmVendorRedemption(user.sub, dto);
  }

  @ApiOperation({ summary: 'List all platform badges' })
  @ApiResponse({
    status: 200,
    description: 'Platform badges returned successfully.',
    schema: { example: [badgeExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/badges')
  listBadges() {
    return this.rewardsService.listBadges();
  }

  @ApiOperation({ summary: 'List my earned customer badges' })
  @ApiResponse({
    status: 200,
    description: 'Customer earned badges returned successfully.',
    schema: { example: [awardedBadgeExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/rewards/me/badges')
  listMyCustomerBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyCustomerBadges(user.sub);
  }

  @ApiOperation({ summary: 'List my earned vendor badges' })
  @ApiResponse({
    status: 200,
    description: 'Vendor earned badges returned successfully.',
    schema: {
      example: [
        {
          id: 'vendor-badge-id',
          vendorId: 'vendor-id',
          badgeId: 'badge-id',
          awardedReason: 'Reached top vendor milestone',
          awardedAt: '2026-09-08T06:10:00.000Z',
          revokedAt: null,
          badge: {
            ...badgeExample,
            ownerType: 'VENDOR',
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor profile is missing or vendor is not approved.',
    schema: { example: forbiddenVendorApprovalExample },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('api/v1/rewards/me/vendor-badges')
  listMyVendorBadges(@CurrentUser() user: AuthenticatedUser) {
    return this.rewardsService.listMyVendorBadges(user.sub);
  }

  @ApiOperation({ summary: 'Create a new reward rule (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Reward rule created successfully.',
    schema: { example: rewardRuleExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid or rule date window is invalid.',
    schema: {
      example: errorExample(
        400,
        'startsAt must be before endsAt',
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Reward rule updated successfully.',
    schema: { example: rewardRuleExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid or rule date window is invalid.',
    schema: {
      example: errorExample(
        400,
        'startsAt must be before endsAt',
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Reward rule was not found.',
    schema: {
      example: errorExample(404, 'Reward rule not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Points awarded or skipped if already awarded.',
    schema: { example: pointsAwardExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        ['points must not be less than 1'],
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Target user was not found.',
    schema: { example: errorExample(404, 'User not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/rewards/points')
  awardPoints(@Body() dto: AwardPointsDto) {
    return this.rewardsService.awardPointsFromDto(dto);
  }

  @ApiOperation({ summary: 'Create a new platform badge (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Badge created successfully.',
    schema: { example: badgeExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid.',
    schema: {
      example: errorExample(
        400,
        [
          'ownerType must be one of the following values: CUSTOMER, VENDOR, BOTH',
        ],
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('api/v1/admin/badges')
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.rewardsService.createBadge(dto);
  }

  @ApiOperation({ summary: 'Manually award a badge to a customer (Admin)' })
  @ApiResponse({
    status: 201,
    description: 'Badge awarded to customer successfully.',
    schema: { example: awardedBadgeExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Badge owner type is not valid for customers.',
    schema: {
      example: errorExample(
        400,
        'Badge is not available for customers',
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Target user or badge was not found.',
    schema: { example: errorExample(404, 'Badge not found', 'Not Found') },
  })
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
  @ApiResponse({
    status: 201,
    description: 'Badge awarded to vendor successfully.',
    schema: {
      example: {
        id: 'vendor-badge-id',
        vendorId: 'vendor-id',
        badgeId: 'badge-id',
        awardedReason: 'Reached top vendor milestone',
        awardedAt: '2026-09-08T06:10:00.000Z',
        revokedAt: null,
        badge: {
          ...badgeExample,
          ownerType: 'VENDOR',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Badge owner type is not valid for vendors.',
    schema: {
      example: errorExample(
        400,
        'Badge is not available for vendors',
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
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenAdminExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Target vendor or badge was not found.',
    schema: { example: errorExample(404, 'Vendor not found', 'Not Found') },
  })
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
