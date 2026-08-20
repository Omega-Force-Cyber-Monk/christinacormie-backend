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

    const loyaltyAccount = await this.rewardsService.getMyLoyaltyAccount(userId);
    const totalPoints = loyaltyAccount.availablePoints;
    const availableCreditAmount = Math.floor(totalPoints / 100);

    const duplicateSince = new Date(Date.now() - 12 * 60 * 60_000);
    const duplicate = await this.checkInsRepository.findRecentCheckIn(
      userId,
      qrCode.foodTruckId,
      duplicateSince,
    );

    if (duplicate) {
      const duplicateCheckIn = await this.checkInsRepository.createDuplicateCheckIn(
        userId,
        qrCode.foodTruckId,
        dto,
      );

      if (duplicateCheckIn) {
        await this.notificationsService.notifyCheckIn(userId, duplicateCheckIn);
      }

      return {
        checkIn: duplicateCheckIn,
        experienceState: 'ALREADY_CHECKED_IN_TODAY',
        availableCreditAmount,
        pointsEarned: 0,
        currentPoints: totalPoints,
        tierName: totalPoints >= 2500 ? 'Drop Legend' : 'Drop Hunter',
        nextTierPoints: 2500,
        message: 'Already checked in today.',
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
      );
      pointsEarned = awardResult.transaction?.points ?? 10;
    }

    if (checkIn) {
      await this.notificationsService.notifyCheckIn(userId, checkIn);
    }

    const updatedAccount = await this.rewardsService.getMyLoyaltyAccount(userId);
    const updatedTotalPoints = updatedAccount.availablePoints;
    const updatedCreditAmount = Math.floor(updatedTotalPoints / 100);

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
      tierName: updatedTotalPoints >= 2500 ? 'Drop Legend' : 'Drop Hunter',
      nextTierPoints: 2500,
      message: `Check-in complete! Earned +${pointsEarned} points.`,
    };
  }

  async getQrAnalytics(userId: string, foodTruckId: string) {
    await this.ensureOwnFoodTruck(userId, foodTruckId);
    const [scanCount, completedScanCount, checkInCount, verifiedCheckInCount, latestScans] =
      await this.checkInsRepository.getQrAnalytics(foodTruckId);

    return {
      scanCount,
      completedScanCount,
      checkInCount,
      verifiedCheckInCount,
      conversionRate:
        scanCount === 0 ? 0 : Number((verifiedCheckInCount / scanCount).toFixed(4)),
      latestScans,
    };
  }

  private async verifyLocation(foodTruckId: string, dto: CreateCheckInDto) {
    const foodTruck = await this.checkInsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (foodTruck.locationValidUntil && foodTruck.locationValidUntil < new Date()) {
      return {
        status: 'REJECTED' as const,
        distanceMeters: null,
        locationVerified: false,
        rejectionReason: 'Truck live location is expired',
        fraudScore: 80,
      };
    }

    const distanceRows = await this.checkInsRepository.calculateDistanceFromTruck(
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
    const allowedDistance = Number(process.env.CHECK_IN_MAX_DISTANCE_METERS ?? 150);
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

    return qrCode;
  }

  private validateLocationPair(latitude?: number, longitude?: number) {
    if (
      (latitude === undefined && longitude !== undefined) ||
      (latitude !== undefined && longitude === undefined)
    ) {
      throw new BadRequestException('latitude and longitude must be provided together');
    }
  }

  private async ensureOwnFoodTruck(userId: string, foodTruckId: string) {
    const vendor = await this.checkInsRepository.findVendorByUserId(userId);

    if (!vendor) {
      throw new ForbiddenException('Vendor profile is required');
    }

    const foodTruck = await this.checkInsRepository.findFoodTruckById(foodTruckId);

    if (!foodTruck || foodTruck.deletedAt) {
      throw new NotFoundException('Food truck not found');
    }

    if (foodTruck.vendorId !== vendor.id) {
      throw new ForbiddenException('Food truck does not belong to this vendor');
    }
  }
}
