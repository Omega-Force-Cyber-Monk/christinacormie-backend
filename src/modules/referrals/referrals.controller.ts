import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { ApplyReferralCodeDto } from './dto/apply-referral-code.dto';
import { CreateReferralCodeDto } from './dto/create-referral-code.dto';
import { ReferralsService } from './referrals.service';

@ApiTags('Referrals')
@ApiBearerAuth()
@Controller()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @ApiOperation({ summary: 'Create a personal referral code' })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/referrals/codes')
  createMyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReferralCodeDto,
  ) {
    return this.referralsService.createMyCode(user.sub, dto);
  }

  @ApiOperation({ summary: 'List my active referral codes' })
  @UseGuards(JwtAuthGuard)
  @Get('api/v1/referrals/codes')
  listMyCodes(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.listMyCodes(user.sub);
  }

  @ApiOperation({ summary: 'Apply a referral code to earn reward bonus' })
  @UseGuards(JwtAuthGuard)
  @Post('api/v1/referrals/apply')
  applyCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyReferralCodeDto,
  ) {
    return this.referralsService.applyCode(user.sub, dto);
  }

  @ApiOperation({ summary: 'Manually qualify a pending referral (Admin)' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/referrals/:referralId/qualify')
  qualifyReferral(@Param('referralId') referralId: string) {
    return this.referralsService.qualifyReferral(referralId);
  }
}
