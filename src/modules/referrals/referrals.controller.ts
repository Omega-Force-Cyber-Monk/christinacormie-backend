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
import { ApplyReferralCodeDto } from './dto/apply-referral-code.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { ReferralsService } from './referrals.service';

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

const referralCodeExample = {
  id: 'referral-code-id',
  ownerUserId: 'referrer-user-id',
  code: 'FRIEND2026',
  programType: 'CUSTOMER',
  usageCount: 1,
  maximumUses: 50,
  isActive: true,
  expiresAt: '2026-12-31T23:59:59.000Z',
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
};

const referralRewardExample = {
  id: 'referral-reward-id',
  referralId: 'referral-id',
  beneficiaryUserId: 'referrer-user-id',
  rewardType: 'POINTS',
  points: 500,
  rewardValue: 500,
  status: 'ISSUED',
  issuedAt: '2026-09-08T06:30:00.000Z',
  redeemedAt: null,
};

const referralExample = {
  id: 'referral-id',
  referralCodeId: 'referral-code-id',
  referrerUserId: 'referrer-user-id',
  referredUserId: 'referred-user-id',
  programType: 'CUSTOMER',
  status: 'PENDING',
  qualifiedAt: null,
  rewardedAt: null,
  createdAt: '2026-09-08T06:10:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  referralCode: referralCodeExample,
};

const referralCodeWithReferralsExample = {
  ...referralCodeExample,
  referrals: [
    {
      ...referralExample,
      referralCode: undefined,
      rewards: [referralRewardExample],
    },
  ],
};

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @ApiOperation({ summary: 'Create a personal referral code' })
  @ApiResponse({
    status: 201,
    description: 'Personal referral code created successfully.',
    schema: { example: referralCodeExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Request body validation failed or expiresAt is not in the future.',
    schema: {
      example: errorExample(
        400,
        'expiresAt must be in the future',
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
    status: 404,
    description: 'Authenticated user was not found.',
    schema: { example: errorExample(404, 'User not found', 'Not Found') },
  })
  @ApiResponse({
    status: 409,
    description: 'Requested referral code already exists.',
    schema: {
      example: errorExample(409, 'Referral code already exists', 'Conflict'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/referrals/codes')
  createMyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReferralCodeDto,
  ) {
    return this.referralsService.createMyCode(user.sub, dto);
  }

  @ApiOperation({ summary: 'List my active referral codes' })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user referral codes returned successfully.',
    schema: { example: [referralCodeWithReferralsExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/referrals/codes')
  listMyCodes(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.listMyCodes(user.sub);
  }

  @ApiOperation({ summary: 'Apply a referral code to earn reward bonus' })
  @ApiResponse({
    status: 201,
    description:
      'Referral code applied successfully. Referral reward is issued later after qualification.',
    schema: { example: referralExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Request body validation failed, own code used, code expired, or usage limit reached.',
    schema: {
      example: errorExample(
        400,
        'You cannot use your own referral code',
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
    status: 404,
    description: 'Authenticated user or referral code was not found.',
    schema: {
      example: errorExample(404, 'Referral code not found', 'Not Found'),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a referral.',
    schema: {
      example: errorExample(409, 'User already has a referral', 'Conflict'),
    },
  })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/referrals/apply')
  applyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyReferralCodeDto,
  ) {
    return this.referralsService.applyCode(user.sub, dto);
  }

  @ApiOperation({ summary: 'Manually qualify a pending referral (Admin)' })
  @ApiResponse({
    status: 200,
    description:
      'Referral qualified/rewarded successfully. Already rewarded referrals are returned unchanged.',
    schema: {
      example: {
        ...referralExample,
        status: 'REWARDED',
        qualifiedAt: '2026-09-08T06:25:00.000Z',
        rewardedAt: '2026-09-08T06:30:00.000Z',
        rewards: [referralRewardExample],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Referral is rejected/expired and cannot be rewarded.',
    schema: {
      example: errorExample(400, 'Referral cannot be rewarded', 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user does not have admin role.',
    schema: { example: forbiddenRoleExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Referral was not found.',
    schema: { example: errorExample(404, 'Referral not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/referrals/:referralId/qualify')
  qualifyReferral(@Param('referralId') referralId: string) {
    return this.referralsService.qualifyReferral(referralId);
  }
}
