import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { ScanQrDto } from './dto/scan-qr.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { CheckInsRepository } from './check-ins.repository';

@Injectable()
export class CheckInsService {
  private readonly vendorApprovalMessage =
    'Vendor account is not approved yet. Please complete onboarding and submit verification documents for admin review.';

  constructor(
    private readonly checkInsRepository: CheckInsRepository,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
  ) {}

  async ensureQrCodesForApprovedVendor(vendorId: string) {
    return this.checkInsRepository.ensureQrCodesForVendor(vendorId);
  }

  async getQrProfile(code: string) {
    const qrCode = await this.ensureActiveQrCode(code);

    return {
      foodTruckId: qrCode.foodTruckId,
      profileSlug: qrCode.foodTruck.slug,
      profileUrl: `/api/v1/food-trucks/profile/${qrCode.foodTruck.slug}`,
      foodTruck: qrCode.foodTruck,
    };
  }

  async recordQrScan(userId: string | undefined, code: string, dto: ScanQrDto) {
    this.validateLocationPair(dto.latitude, dto.longitude);
    const qrCode = await this.ensureActiveQrCode(code);

    return this.checkInsRepository.recordScan(
      qrCode.id,
      qrCode.foodTruckId,
      userId,
      dto,
    );
  }

  async createCheckIn(userId: string, code: string, dto: CreateCheckInDto) {
    const qrCode = await this.ensureActiveQrCode(code);

    if (dto.qrScanId) {
      const scan = await this.checkInsRepository.findQrScanById(dto.qrScanId);

      if (!scan || scan.foodTruckId !== qrCode.foodTruckId) {
        throw new BadRequestException('QR scan does not match this truck');
      }
    }

    const loyaltyAccount =
      await this.rewardsService.getMyLoyaltyAccount(userId);
    const totalPoints = loyaltyAccount.availablePoints;
    const loyaltyProgress = this.rewardsService.getLoyaltyProgressForPoints(
      loyaltyAccount.availablePoints,
      loyaltyAccount.lifetimePoints,
      loyaltyAccount.redeemedPoints,
    );

    const firstVerifiedCheckIn =
      await this.checkInsRepository.findFirstVerifiedCheckIn(userId);

    if (firstVerifiedCheckIn) {
      const ineligibleCheckIn =
        await this.checkInsRepository.createDuplicateCheckIn(
          userId,
          qrCode.foodTruckId,
          dto,
          'Customer is not eligible for check-in points after first successful QR check-in',
        );

      if (ineligibleCheckIn) {
        await this.notificationsService.notifyCheckIn(
          userId,
          ineligibleCheckIn,
        );
      }

      return {
        checkIn: ineligibleCheckIn,
        experienceState: 'NOT_ELIGIBLE_FOR_CHECK_IN_POINTS',
        availableCreditAmount: loyaltyProgress.availableCreditAmount,
        pointsEarned: 0,
        currentPoints: totalPoints,
        tierName: loyaltyProgress.currentTier.name,
        nextTierPoints: loyaltyProgress.nextTier?.requiredPoints ?? null,
        message:
          'You are not eligible for check-in points right now. First-time QR check-in points can only be earned once.',
      };
    }

    const verification = await this.verifyLocation(qrCode.foodTruckId, dto);

    const checkIn = await this.checkInsRepository.createCheckIn(
      userId,
      qrCode.foodTruckId,
      dto,
      verification,
    );

    let pointsEarned = 0;
    if (checkIn?.status === 'VERIFIED') {
      const awardResult = await this.rewardsService.awardPoints(
        userId,
        'CHECK_IN',
        checkIn.id,
        {
          idempotencyKey: `FIRST_QR_CHECK_IN:${userId}`,
          description: 'First-time QR check-in bonus',
        },
      );
      pointsEarned = awardResult.awarded
        ? (awardResult.transaction?.points ?? 10)
        : 0;
    }

    if (checkIn) {
      await this.notificationsService.notifyCheckIn(userId, checkIn);
    }

    const updatedAccount =
      await this.rewardsService.getMyLoyaltyAccount(userId);
    const updatedProgress = this.rewardsService.getLoyaltyProgressForPoints(
      updatedAccount.availablePoints,
      updatedAccount.lifetimePoints,
      updatedAccount.redeemedPoints,
    );
    const updatedTotalPoints = updatedAccount.availablePoints;
    const updatedCreditAmount = updatedProgress.availableCreditAmount;

    let experienceState = 'NEW_USER';
    if (updatedCreditAmount >= 5) {
      experienceState = 'HAS_CREDIT_AVAILABLE';
    } else if (updatedTotalPoints > pointsEarned) {
      experienceState = 'HAS_POINTS_NO_CREDIT';
    } else {
      experienceState = 'NEW_USER';
    }

    return {
      checkIn,
      experienceState,
      availableCreditAmount: updatedCreditAmount,
      pointsEarned,
      currentPoints: updatedTotalPoints,
      tierName: updatedProgress.currentTier.name,
      nextTierPoints: updatedProgress.nextTier?.requiredPoints ?? null,
      message: `Check-in complete! Earned +${pointsEarned} points.`,
    };
  }

  async getQrAnalytics(userId: string, foodTruckId: string) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const [
      scanCount,
      completedScanCount,
      checkInCount,
      verifiedCheckInCount,
      latestScans,
    ] = await this.checkInsRepository.getQrAnalytics(foodTruckId);

    return {
      scanCount,
      completedScanCount,
      checkInCount,
      verifiedCheckInCount,
      conversionRate:
        scanCount === 0
          ? 0
          : Number((verifiedCheckInCount / scanCount).toFixed(4)),
      latestScans,
    };
  }

  private async verifyLocation(foodTruckId: string, dto: CreateCheckInDto) {
    const foodTruck =
      await this.checkInsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (
      foodTruck.locationValidUntil &&
      foodTruck.locationValidUntil < new Date()
    ) {
      return {
        status: 'REJECTED' as const,
        distanceMeters: null,
        locationVerified: false,
        rejectionReason: 'Truck live location is expired',
        fraudScore: 80,
      };
    }

    const distanceRows =
      await this.checkInsRepository.calculateDistanceFromTruck(
        foodTruckId,
        dto,
      );

    if (!distanceRows.length) {
      return {
        status: 'REJECTED' as const,
        distanceMeters: null,
        locationVerified: false,
        rejectionReason: 'Truck live location is not available',
        fraudScore: 80,
      };
    }

    const distanceMeters = Number(distanceRows[0]?.distanceMeters ?? 999999);
    const allowedDistance = Number(
      process.env.CHECK_IN_MAX_DISTANCE_METERS ?? 150,
    );
    const accuracyPenalty =
      dto.locationAccuracyMeters && dto.locationAccuracyMeters > 100 ? 20 : 0;
    const locationVerified = distanceMeters <= allowedDistance;

    return {
      status: locationVerified ? ('VERIFIED' as const) : ('REJECTED' as const),
      distanceMeters,
      locationVerified,
      rejectionReason: locationVerified
        ? undefined
        : 'User is too far from truck location',
      fraudScore: locationVerified
        ? Math.min(30 + accuracyPenalty, 100)
        : Math.min(70 + accuracyPenalty, 100),
    };
  }

  private async ensureActiveQrCode(code: string) {
    const qrCode = await this.checkInsRepository.findQrByCode(code);

    if (!qrCode || qrCode.status !== 'ACTIVE' || qrCode.foodTruck.deletedAt) {
      throw new NotFoundException('QR code not found');
    }

    if (
      qrCode.foodTruck.status !== 'ACTIVE' ||
      qrCode.foodTruck.vendor.deletedAt ||
      qrCode.foodTruck.vendor.status !== 'APPROVED' ||
      !qrCode.foodTruck.vendor.isVerified
    ) {
      throw new ForbiddenException(
        'This food truck QR code is not available until the vendor is approved.',
      );
    }

    return qrCode;
  }

  private validateLocationPair(latitude?: number, longitude?: number) {
    if (
      (latitude === undefined && longitude !== undefined) ||
      (latitude !== undefined && longitude === undefined)
    ) {
      throw new BadRequestException(
        'latitude and longitude must be provided together',
      );
    }
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.checkInsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    if (vendor.status !== 'APPROVED' || !vendor.isVerified) {
      throw new ForbiddenException(this.vendorApprovalMessage);
    }

    const foodTruck =
      await this.checkInsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }
  }
}
