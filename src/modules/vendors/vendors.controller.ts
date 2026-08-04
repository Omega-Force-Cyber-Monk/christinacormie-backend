import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me')
  getMyVendorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorProfile(user.sub);
  }

  @Roles(UserRole.VENDOR)
  @Patch('api/v1/vendors/me')
  updateMyVendorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVendorProfileDto,
  ) {
    return this.vendorsService.updateMyVendorProfile(user.sub, dto);
  }

  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/verification-requests')
  submitVerificationRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationRequestDto,
  ) {
    return this.vendorsService.submitVerificationRequest(user.sub, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('api/v1/admin/vendors/pending-approval')
  getPendingApprovalVendors() {
    return this.vendorsService.getPendingApprovalVendors();
  }

  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/vendors/:id/approve')
  approveVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vendorId: string,
  ) {
    return this.vendorsService.approveVendor(vendorId, user.sub);
  }

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
