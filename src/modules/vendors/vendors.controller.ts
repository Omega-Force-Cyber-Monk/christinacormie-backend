import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiConflictResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CompleteVendorOnboardingDto } from './dto/complete-vendor-onboarding.dto';
import { RejectVendorDto } from './dto/reject-vendor.dto';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdatePhotoShootRequestDto } from './dto/update-photo-shoot-request.dto';
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

  @ApiOperation({ summary: 'Get my vendor BiteDrop QR code details for display and sharing' })
  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me/qr-code')
  getMyVendorQrCode(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorQrCode(user.sub);
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

  @ApiOperation({
    summary: 'Complete vendor onboarding in one request',
    description:
      'This endpoint accepts JSON only. Upload truck/logo/menu images first through POST /api/v1/vendors/me/onboarding/upload, then pass the returned Cloudinary URLs in truckLogoUrl, truckImageUrl, logoUrl, or menuItem.photoUrl. Phone number is accepted only through contact.phoneNumber.',
  })
  @ApiConflictResponse({
    description:
      'Returned when contact.email or contact.phoneNumber is already used by another account.',
  })
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/onboarding')
  completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteVendorOnboardingDto,
  ) {
    return this.vendorsService.completeOnboarding(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Upload onboarding image asset to Cloudinary',
    description:
      'Use this multipart endpoint before vendor onboarding when you need a Cloudinary URL for truck logo, truck image, or menu image.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Roles(UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('file'))
  @Post('api/v1/vendors/me/onboarding/upload')
  uploadOnboardingAsset(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.vendorsService.uploadOnboardingAsset(user.sub, file);
  }

  @ApiOperation({
    summary: 'Submit vendor verification documents',
    description:
      'This endpoint accepts JSON only. Upload each verification file first through POST /api/v1/vendors/me/verification-requests/upload, then send the returned Cloudinary URL in documents[].url.',
  })
  @ApiBody({
    type: SubmitVerificationRequestDto,
    examples: {
      texasVendor: {
        summary: 'Texas vendor payload',
        description:
          'Use this when the vendor state is Texas (TX). Required document types are DSHS license, Food Manager Certification, and COI.',
        value: {
          documents: [
            {
              type: 'DSHS_MOBILE_FOOD_VENDOR_LICENSE',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/dshs-license.pdf',
            },
            {
              type: 'FOOD_MANAGER_CERTIFICATION',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/food-manager-certification.pdf',
            },
            {
              type: 'CERTIFICATE_OF_INSURANCE',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/certificate-of-insurance.pdf',
            },
          ],
          notes:
            'Texas vendor verification documents submitted for admin review.',
        },
      },
      nonTexasVendor: {
        summary: 'Non-Texas vendor payload',
        description:
          'Use this when the vendor state is outside Texas. Required document types are state/local permit, Food Manager Certification, and COI.',
        value: {
          documents: [
            {
              type: 'STATE_OR_LOCAL_FOOD_VENDOR_PERMIT',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/state-or-local-permit.pdf',
            },
            {
              type: 'FOOD_MANAGER_CERTIFICATION',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/food-manager-certification.pdf',
            },
            {
              type: 'CERTIFICATE_OF_INSURANCE',
              url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/certificate-of-insurance.pdf',
            },
          ],
          notes:
            'Non-Texas vendor verification documents submitted for admin review.',
        },
      },
    },
  })
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/verification-requests')
  submitVerificationRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationRequestDto,
  ) {
    return this.vendorsService.submitVerificationRequest(user.sub, dto);
  }

  @ApiOperation({
    summary: 'Upload vendor verification document to Cloudinary',
    description:
      'Use this multipart endpoint before submitting verification documents when you need a Cloudinary URL for PDF or document files.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @Roles(UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('file'))
  @Post('api/v1/vendors/me/verification-requests/upload')
  uploadVerificationDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.vendorsService.uploadVerificationDocument(user.sub, file);
  }

  @ApiOperation({ summary: 'List vendor photo shoot requests (Admin)' })
  @Roles(UserRole.ADMIN)
  @Get('api/v1/admin/photo-shoot-requests')
  getPhotoShootRequests() {
    return this.vendorsService.getPhotoShootRequests();
  }

  @ApiOperation({ summary: 'Update a vendor photo shoot request (Admin)' })
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/photo-shoot-requests/:id')
  updatePhotoShootRequest(
    @Param('id') requestId: string,
    @Body() dto: UpdatePhotoShootRequestDto,
  ) {
    return this.vendorsService.updatePhotoShootRequest(requestId, dto);
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
