import {
  Body,
  Controller,
  Delete,
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
  ApiResponse,
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
import { CreateVendorStaffDto } from './dto/create-vendor-staff.dto';
import { RejectVendorDto } from './dto/reject-vendor.dto';
import { ResetVendorStaffPinDto } from './dto/reset-vendor-staff-pin.dto';
import { SubmitVerificationRequestDto } from './dto/submit-verification-request.dto';
import { UpdatePhotoShootRequestDto } from './dto/update-photo-shoot-request.dto';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';
import { VendorsService } from './vendors.service';

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
const forbiddenVendorExample = errorExample(
  403,
  'Forbidden resource',
  'Forbidden',
);
const vendorApprovalErrorExample = errorExample(
  403,
  'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
  'Forbidden',
);

const vendorProfileExample = {
  id: '12441f40-2dc9-456d-948a-c33135359c70',
  userId: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
  marketId: null,
  businessName: 'Taco Paradise',
  businessEmail: 'contact@tacoparadise.com',
  businessPhone: '+12025550199',
  description: 'Best authentic gourmet street tacos in Austin',
  logoUrl: 'https://cdn.bitedrop.com/vendors/taco-paradise-logo.png',
  websiteUrl: 'https://tacoparadise.example.com',
  selectedPlan: 'FREE',
  status: 'PENDING_APPROVAL',
  isVerified: false,
  verifiedAt: null,
  reliabilityScore: 0,
  rejectionReason: null,
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:10:00.000Z',
  user: {
    id: '7c8c9420-0d7f-4b77-9f2b-57aa58b91541',
    email: 'vendor@example.com',
    phone: '+12025550199',
    status: 'ACTIVE',
    profile: {
      displayName: 'Taco Owner',
      city: 'Austin',
      state: 'TX',
      country: 'USA',
    },
    userRoles: [{ role: 'VENDOR' }],
  },
  market: null,
  verificationRequests: [],
  foodTrucks: [],
  verificationRequirements: {
    state: 'TX',
    normalizedState: 'TX',
    requirementSet: 'TEXAS',
    requiredDocumentTypes: [
      'DSHS_MOBILE_FOOD_VENDOR_LICENSE',
      'FOOD_MANAGER_CERTIFICATION',
      'CERTIFICATE_OF_INSURANCE',
    ],
    pendingUntilApproved: true,
  },
};

const vendorQrCodeExample = {
  vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
  businessName: 'Taco Paradise',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  qrCode: 'truck_abcd1234xyz',
  qrCodeUrl: '/api/v1/qr/truck_abcd1234xyz/profile',
  downloadUrl: null,
  shareMessage:
    'Scan our BiteDrop QR code at Taco Paradise to check in and earn rewards!',
};

const vendorAnalyticsExample = {
  totalFoodTrucks: 1,
  totalBookings: 12,
  totalRevenue: 2450.5,
  totalReviews: 102,
  averageRating: 4.8,
  totalFollowers: 12500,
  totalCheckIns: 16500,
  recentBookings: [
    {
      id: 'booking-id',
      bookingNumber: 'BD-20260908-001',
      bookingType: 'EVENT',
      status: 'ACCEPTED',
      totalAmount: 800,
      startsAt: '2026-09-20T18:00:00.000Z',
      createdAt: '2026-09-08T06:00:00.000Z',
    },
  ],
  paymentSummary: [{ status: 'SUCCEEDED', count: 8, totalAmount: 2450.5 }],
  topTrucks: [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Taco Paradise',
      slug: 'taco-paradise',
      status: 'ACTIVE',
      averageRating: 4.8,
      totalReviews: 102,
      totalBookings: 12,
      totalCheckIns: 16500,
      followerCount: 12500,
    },
  ],
};

const uploadResponseExample = {
  url: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/truck.jpg',
  publicId: 'bitedrop/vendors/onboarding/truck',
  width: 1200,
  height: 800,
  format: 'jpg',
  resourceType: 'image',
  originalFilename: 'truck.jpg',
};

const documentUploadResponseExample = {
  url: 'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/permit.pdf',
  publicId: 'bitedrop/vendors/vendor-id/verification-documents/permit',
  format: 'pdf',
  bytes: 245760,
  resourceType: 'raw',
  originalFilename: 'permit.pdf',
};

const onboardingResponseExample = {
  vendor: {
    ...vendorProfileExample,
    businessName: 'Taco Paradise',
  },
  foodTruck: {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    status: 'DRAFT',
    operatingStatus: 'CLOSED',
  },
  message: 'Vendor onboarding saved successfully.',
  photoShootMessage: null,
};

const verificationRequestResponseExample = {
  vendor: {
    ...vendorProfileExample,
    status: 'PENDING_APPROVAL',
  },
  verificationRequest: {
    id: 'verification-request-id',
    vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
    documents: [
      {
        type: 'DSHS_MOBILE_FOOD_VENDOR_LICENSE',
        url: 'https://res.cloudinary.com/demo/raw/upload/dshs-license.pdf',
      },
    ],
    notes: 'Texas vendor verification documents submitted for review.',
    status: 'PENDING',
    createdAt: '2026-09-08T06:10:00.000Z',
    updatedAt: '2026-09-08T06:10:00.000Z',
  },
  message:
    'Thank you for submitting your documents. Our team will review and get back to you shortly.',
  verificationRequirements: vendorProfileExample.verificationRequirements,
};

const photoShootRequestExample = {
  id: 'photo-shoot-request-id',
  vendorId: '12441f40-2dc9-456d-948a-c33135359c70',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  notes: 'Vendor contacted and shoot scheduled.',
  status: 'SCHEDULED',
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:20:00.000Z',
};

const approveVendorResponseExample = {
  vendor: {
    ...vendorProfileExample,
    status: 'APPROVED',
    isVerified: true,
    verifiedAt: '2026-09-08T06:20:00.000Z',
    approvedAt: '2026-09-08T06:20:00.000Z',
  },
  qrCodes: [
    {
      id: 'qr-code-id',
      foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      code: 'truck_abcd1234xyz',
      status: 'ACTIVE',
      qrImageUrl: null,
    },
  ],
};

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @ApiOperation({ summary: 'Get my vendor profile details' })
  @ApiResponse({
    status: 200,
    description:
      'Current vendor profile returned with verification requirements.',
    schema: { example: vendorProfileExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found for the authenticated user.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
    },
  })
  @Roles(UserRole.VENDOR, UserRole.VENDOR_STAFF)
  @Get('api/v1/vendors/me')
  getMyVendorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorProfile(user.sub);
  }

  @ApiOperation({
    summary: 'Get my vendor BiteDrop QR code details for display and sharing',
  })
  @ApiResponse({
    status: 200,
    description: 'Approved vendor QR code details returned successfully.',
    schema: { example: vendorQrCodeExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor is not approved or authenticated user is not vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
    },
  })
  @Roles(UserRole.VENDOR, UserRole.VENDOR_STAFF)
  @Get('api/v1/vendors/me/qr-code')
  getMyVendorQrCode(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorQrCode(user.sub);
  }

  @ApiOperation({ summary: 'List staff members for my vendor account' })
  @ApiResponse({
    status: 200,
    description: 'Staff members returned successfully.',
    schema: {
      example: {
        items: [
          {
            id: 'staff-id',
            email: 'maria@example.com',
            pin: '1504',
            status: 'ACTIVE',
            addedAt: '2026-09-14T09:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user does not have vendor owner role.',
    schema: { example: forbiddenVendorExample },
  })
  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me/staff')
  listStaff(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.listStaff(user.sub);
  }

  @ApiOperation({ summary: 'Create a staff account with email and 4-digit PIN' })
  @ApiResponse({
    status: 201,
    description: 'Staff account created and PIN sent to email.',
    schema: {
      example: {
        id: 'staff-id',
        email: 'maria@example.com',
        pin: '1504',
        status: 'ACTIVE',
        addedAt: '2026-09-14T09:00:00.000Z',
        message: 'Staff account created and PIN sent to email',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body is invalid or staff account cannot be created.',
    schema: {
      example: errorExample(
        400,
        'Staff PIN must be exactly 4 digits',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Staff member already exists for this vendor.',
    schema: {
      example: errorExample(
        409,
        'Staff member already exists for this vendor',
        'Conflict',
      ),
    },
  })
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/staff')
  addStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVendorStaffDto,
  ) {
    return this.vendorsService.addStaff(user.sub, dto);
  }

  @ApiOperation({ summary: 'Reset a staff member PIN manually' })
  @ApiResponse({
    status: 201,
    description: 'Staff PIN reset and sent to email.',
    schema: {
      example: {
        id: 'staff-id',
        email: 'maria@example.com',
        pin: '5678',
        status: 'ACTIVE',
        addedAt: '2026-09-14T09:00:00.000Z',
        message: 'Staff PIN reset successfully and sent to email',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Staff member was not found.',
    schema: {
      example: errorExample(404, 'Staff member not found', 'Not Found'),
    },
  })
  @Roles(UserRole.VENDOR)
  @Post('api/v1/vendors/me/staff/:staffId/reset-pin')
  resetStaffPin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId') staffId: string,
    @Body() dto: ResetVendorStaffPinDto,
  ) {
    return this.vendorsService.resetStaffPin(user.sub, staffId, dto);
  }

  @ApiOperation({ summary: 'Delete a staff member from my vendor account' })
  @ApiResponse({
    status: 200,
    description: 'Staff member deleted successfully.',
    schema: {
      example: {
        deleted: true,
        message: 'Staff member deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Staff member was not found.',
    schema: {
      example: errorExample(404, 'Staff member not found', 'Not Found'),
    },
  })
  @Roles(UserRole.VENDOR)
  @Delete('api/v1/vendors/me/staff/:staffId')
  deleteStaff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId') staffId: string,
  ) {
    return this.vendorsService.deleteStaff(user.sub, staffId);
  }

  @ApiOperation({ summary: 'Get vendor dashboard analytics overview' })
  @ApiResponse({
    status: 200,
    description: 'Approved vendor dashboard analytics returned successfully.',
    schema: { example: vendorAnalyticsExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Vendor is not approved or authenticated user is not vendor.',
    schema: { example: vendorApprovalErrorExample },
  })
  @Roles(UserRole.VENDOR)
  @Get('api/v1/vendors/me/analytics')
  getMyVendorAnalytics(@CurrentUser() user: AuthenticatedUser) {
    return this.vendorsService.getMyVendorAnalytics(user.sub);
  }

  @ApiOperation({ summary: 'Update my vendor business profile' })
  @ApiResponse({
    status: 200,
    description: 'Vendor business profile updated successfully.',
    schema: { example: vendorProfileExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['businessEmail must be an email'],
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
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
    },
  })
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
  @ApiResponse({
    status: 201,
    description:
      'Vendor onboarding saved and draft food truck profile created/updated.',
    schema: { example: onboardingResponseExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['truckName must be shorter than or equal to 255 characters'],
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
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 409,
    description:
      'Contact email or phone is already used by another user account.',
    schema: {
      example: errorExample(
        409,
        'Contact email is already used by another account',
        'Conflict',
      ),
    },
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
  @ApiResponse({
    status: 201,
    description: 'Onboarding image uploaded successfully.',
    schema: { example: uploadResponseExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'File is missing, file is not an image, or Cloudinary is not configured.',
    schema: {
      example: errorExample(
        400,
        'Only image files are allowed for onboarding assets',
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
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
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
  @ApiResponse({
    status: 201,
    description:
      'Verification request submitted. Vendor moves to pending approval.',
    schema: { example: verificationRequestResponseExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Vendor state is missing, duplicate document type exists, required documents are missing, or body is invalid.',
    schema: {
      example: errorExample(
        400,
        'Missing required verification documents: DSHS_MOBILE_FOOD_VENDOR_LICENSE',
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
      'Authenticated user is not vendor, or vendor is already approved.',
    schema: {
      example: errorExample(
        403,
        'Approved vendors are already verified',
        'Forbidden',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
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
  @ApiResponse({
    status: 201,
    description: 'Verification document uploaded successfully.',
    schema: { example: documentUploadResponseExample },
  })
  @ApiResponse({
    status: 400,
    description: 'File is missing or Cloudinary is not configured.',
    schema: {
      example: errorExample(400, 'File upload is required', 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user does not have vendor role.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor profile was not found.',
    schema: {
      example: errorExample(404, 'Vendor profile not found', 'Not Found'),
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
  @ApiResponse({
    status: 200,
    description: 'Vendor photo shoot requests returned successfully.',
    schema: { example: [photoShootRequestExample] },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenVendorExample },
  })
  @Roles(UserRole.ADMIN)
  @Get('api/v1/admin/photo-shoot-requests')
  getPhotoShootRequests() {
    return this.vendorsService.getPhotoShootRequests();
  }

  @ApiOperation({ summary: 'Update a vendor photo shoot request (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Vendor photo shoot request updated successfully.',
    schema: { example: photoShootRequestExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        [
          'status must be one of the following values: PENDING, CONTACTED, SCHEDULED, COMPLETED, CANCELLED',
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
    schema: { example: forbiddenVendorExample },
  })
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/photo-shoot-requests/:id')
  updatePhotoShootRequest(
    @Param('id') requestId: string,
    @Body() dto: UpdatePhotoShootRequestDto,
  ) {
    return this.vendorsService.updatePhotoShootRequest(requestId, dto);
  }

  @ApiOperation({ summary: 'Approve a vendor application (Admin)' })
  @ApiResponse({
    status: 200,
    description:
      'Vendor approved successfully and QR codes are ensured for vendor food trucks.',
    schema: { example: approveVendorResponseExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description: 'Authenticated user is not an admin.',
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor was not found.',
    schema: { example: errorExample(404, 'Vendor not found', 'Not Found') },
  })
  @Roles(UserRole.ADMIN)
  @Patch('api/v1/admin/vendors/:id/approve')
  approveVendor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') vendorId: string,
  ) {
    return this.vendorsService.approveVendor(vendorId, user.sub);
  }

  @ApiOperation({ summary: 'Reject a vendor application (Admin)' })
  @ApiResponse({
    status: 200,
    description: 'Vendor rejected successfully.',
    schema: {
      example: {
        ...vendorProfileExample,
        status: 'REJECTED',
        isVerified: false,
        rejectionReason:
          'Incomplete business permit documents provided. Please upload a valid health safety license.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Request body validation failed.',
    schema: {
      example: errorExample(
        400,
        ['rejectionReason must be shorter than or equal to 1000 characters'],
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
    schema: { example: forbiddenVendorExample },
  })
  @ApiResponse({
    status: 404,
    description: 'Vendor was not found.',
    schema: { example: errorExample(404, 'Vendor not found', 'Not Found') },
  })
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
