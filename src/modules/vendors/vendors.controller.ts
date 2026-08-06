import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { RejectVendorDto } from './dto/reject-vendor.dto';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorsService } from './vendors.service';

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @ApiOperation({ summary: 'Get my vendor profile details' })
  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me')
  getMyVendorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorProfile(user.sub);
  }

  @ApiOperation({ summary: 'Get vendor dashboard analytics overview' })
  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me/analytics')
  getMyVendorAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorAnalytics(user.sub);
  }

  @ApiOperation({ summary: 'Update my vendor business profile' })
  @Roles(UserRole.VENDOR)
  @Patch('api/v1/vendors/me')
  updateMyVendorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.vendorsService.updateMyVendorProfile(user.sub, dto);
  }

  @ApiOperation({ summary: 'Submit vendor verification documents' })
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/verification-requests')
  submitVerificationRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationRequestDto,
  ) {
    return this.vendorsService.submitVerificationRequest(user.sub, dto);
  }

  @ApiOperation({ summary: 'List vendors pending approval (Admin)' })
  @Roles(UserRole.ADMIN)
  @Get('api/v1/admin/vendors/pending-approval')
  getPendingApprovalVendors() {
    return this.vendorsService.getPendingApprovalVendors();
  }

  @ApiOperation({ summary: 'Approve a vendor application (Admin)' })
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/vendors/:id/approve')
  approveVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vendorId: string,
  ) {
    return this.vendorsService.approveVendor(vendorId, user.sub);
  }

  @ApiOperation({ summary: 'Reject a vendor application (Admin)' })
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/vendors/:id/reject')
  rejectVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vendorId: string,
    @Body() dto: RejectVendorDto,
  ) {
    return this.vendorsService.rejectVendor(
      vendorId,
      user.sub,
      dto.rejectionReason,
    );
  }
}
