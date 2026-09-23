import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-request.interface';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { ScanQrDto } from './dto/scan-qr.dto';
import { CheckInsService } from './check-ins.service';

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
const qrUnavailableExample = errorExample(
  403,
  'This food truck QR code is not available until the vendor is approved.',
  'Forbidden',
);

const qrProfileExample = {
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  profileSlug: 'taco-paradise',
  profileUrl: '/api/v1/food-trucks/profile/taco-paradise',
  foodTruck: {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
    status: 'ACTIVE',
    locationValidUntil: '2026-09-08T08:00:00.000Z',
    deletedAt: null,
    vendor: {
      id: '12441f40-2dc9-456d-948a-c33135359c70',
      status: 'APPROVED',
      isVerified: true,
      deletedAt: null,
    },
  },
};

const qrScanExample = {
  id: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  qrCodeId: 'qr-code-id',
  foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  userId: 'customer-user-id',
  anonymousSessionId: null,
  openedProfile: true,
  scannedAt: '2026-09-08T06:10:00.000Z',
  foodTruck: {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
  },
};

const checkInExample = {
  checkIn: {
    id: 'check-in-id',
    userId: 'customer-user-id',
    foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    qrScanId: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
    status: 'VERIFIED',
    verificationMethod: 'QR_LOCATION',
    distanceMeters: 25.4,
    locationAccuracyMeters: 10,
    deviceId: 'device_iphone14_xyz',
    fraudScore: 30,
    locationVerified: true,
    rejectionReason: null,
    checkedInAt: '2026-09-08T06:10:00.000Z',
    verifiedAt: '2026-09-08T06:10:00.000Z',
    foodTruck: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Taco Paradise',
      slug: 'taco-paradise',
    },
  },
  experienceState: 'NEW_USER',
  availableCreditAmount: 0,
  pointsEarned: 10,
  currentPoints: 10,
  tierName: 'Foodie',
  nextTierPoints: 500,
  message: 'Check-in complete! Earned +10 points.',
};

const duplicateCheckInExample = {
  ...checkInExample,
  checkIn: {
    ...checkInExample.checkIn,
    status: 'DUPLICATE',
    locationVerified: false,
    rejectionReason:
      'Customer is not eligible for check-in points after first successful QR check-in',
  },
  experienceState: 'NOT_ELIGIBLE_FOR_CHECK_IN_POINTS',
  pointsEarned: 0,
  currentPoints: 10,
  message:
    'You are not eligible for check-in points right now. First-time QR check-in points can only be earned once.',
};

const qrAnalyticsExample = {
  scanCount: 120,
  completedScanCount: 80,
  checkInCount: 75,
  verifiedCheckInCount: 70,
  conversionRate: 0.5833,
  latestScans: [
    {
      id: 'qr-scan-id',
      qrCodeId: 'qr-code-id',
      foodTruckId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      userId: 'customer-user-id',
      anonymousSessionId: null,
      openedProfile: true,
      completedCheckIn: true,
      scannedAt: '2026-09-08T06:10:00.000Z',
    },
  ],
};

@ApiTags('Check-Ins & QR')
@Controller('api/v1/qr')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @ApiOperation({ summary: 'Get food truck profile linked to a QR code' })
  @ApiResponse({
    status: 200,
    description:
      'Active QR code resolved to approved vendor food truck profile.',
    schema: { example: qrProfileExample },
  })
  @ApiResponse({
    status: 403,
    description: 'QR code belongs to an unapproved vendor or inactive truck.',
    schema: { example: qrUnavailableExample },
  })
  @ApiResponse({
    status: 404,
    description: 'QR code was not found or is inactive.',
    schema: { example: errorExample(404, 'QR code not found', 'Not Found') },
  })
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':code/profile')
  getQrProfile(@Param('code') code: string) {
    return this.checkInsService.getQrProfile(code);
  }

  @ApiOperation({ summary: 'Record an anonymous QR code scan' })
  @ApiResponse({
    status: 201,
    description: 'Anonymous QR scan recorded successfully.',
    schema: {
      example: {
        ...qrScanExample,
        userId: null,
        anonymousSessionId: 'anon_sess_abc123xyz',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Latitude/longitude validation failed.',
    schema: {
      example: errorExample(
        400,
        'latitude and longitude must be provided together',
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 403,
    description: 'QR code belongs to an unapproved vendor or inactive truck.',
    schema: { example: qrUnavailableExample },
  })
  @ApiResponse({
    status: 404,
    description: 'QR code was not found or is inactive.',
    schema: { example: errorExample(404, 'QR code not found', 'Not Found') },
  })
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':code/scans')
  recordAnonymousQrScan(@Param('code') code: string, @Body() dto: ScanQrDto) {
    return this.checkInsService.recordQrScan(undefined, code, dto);
  }

  @ApiOperation({ summary: 'Record an authenticated user QR code scan' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Authenticated QR scan recorded successfully.',
    schema: { example: qrScanExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Latitude/longitude validation failed.',
    schema: {
      example: errorExample(
        400,
        'latitude and longitude must be provided together',
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
    description: 'QR code belongs to an unapproved vendor or inactive truck.',
    schema: { example: qrUnavailableExample },
  })
  @ApiResponse({
    status: 404,
    description: 'QR code was not found or is inactive.',
    schema: { example: errorExample(404, 'QR code not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Post(':code/scans/authenticated')
  recordAuthenticatedQrScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: ScanQrDto,
  ) {
    return this.checkInsService.recordQrScan(user.sub, code, dto);
  }

  @ApiOperation({
    summary: 'Check-in at a food truck using QR code (Customer)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description:
      'Check-in completed. First successful QR check-in can award +10 points.',
    schema: {
      examples: {
        firstCheckIn: {
          summary: 'First successful check-in',
          value: checkInExample,
        },
        notEligibleForPoints: {
          summary: 'Customer already received first QR check-in points',
          value: duplicateCheckInExample,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'QR scan mismatch, latitude/longitude validation failed, or invalid body.',
    schema: {
      example: errorExample(
        400,
        'QR scan does not match this truck',
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
    description: 'QR code belongs to an unapproved vendor or inactive truck.',
    schema: { example: qrUnavailableExample },
  })
  @ApiResponse({
    status: 404,
    description: 'QR code or food truck was not found.',
    schema: { example: errorExample(404, 'QR code not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post(':code/check-ins')
  createCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('code') code: string,
    @Body() dto: CreateCheckInDto,
  ) {
    return this.checkInsService.createCheckIn(user.sub, code, dto);
  }
}

@ApiTags('Check-Ins & QR')
@ApiBearerAuth()
@Controller('api/v1/check-ins')
export class CheckInAnalyticsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @ApiOperation({
    summary: 'Get QR scan and check-in analytics for a food truck (Vendor)',
  })
  @ApiResponse({
    status: 200,
    description: 'QR scan and check-in analytics returned for vendor truck.',
    schema: { example: qrAnalyticsExample },
  })
  @ApiResponse({
    status: 401,
    description: 'Access token is missing, invalid, or expired.',
    schema: { example: unauthorizedExample },
  })
  @ApiResponse({
    status: 403,
    description:
      'Vendor is not approved, user is not a vendor, or truck belongs to another vendor.',
    schema: {
      examples: {
        vendorNotApproved: {
          summary: 'Vendor is not approved',
          value: errorExample(
            403,
            'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.',
            'Forbidden',
          ),
        },
        wrongVendor: {
          summary: 'Food truck does not belong to vendor',
          value: errorExample(
            403,
            'Food truck does not belong to this vendor',
            'Forbidden',
          ),
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Food truck was not found.',
    schema: { example: errorExample(404, 'Food truck not found', 'Not Found') },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('food-trucks/:foodTruckId/qr-analytics')
  getQrAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('foodTruckId') foodTruckId: string,
  ) {
    return this.checkInsService.getQrAnalytics(user.sub, foodTruckId);
  }
}
