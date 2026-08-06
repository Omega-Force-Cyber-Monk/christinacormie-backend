import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { ScanQrDto } from './dto/scan-qr.dto';

type DistanceRow = {
  distanceMeters: unknown;
};

@Injectable()
export class CheckInsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: { id: true },
    });
  }

  findFoodTruckById(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        id: true,
        vendorId: true,
        name: true,
        slug: true,
        locationValidUntil: true,
        deletedAt: true,
      },
    });
  }

  findQrByCode(code: string) {
    return this.prisma.truckQrCode.findUnique({
      where: { code },
      include: {
        foodTruck: {
          select: {
            id: true,
            name: true,
            slug: true,
            profileImageUrl: true,
            locationValidUntil: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  findQrByFoodTruck(foodTruckId: string) {
    return this.prisma.truckQrCode.findFirst({
      where: {
        foodTruckId,
        status: 'ACTIVE',
      },
    });
  }

  async ensureTruckQrCode(foodTruckId: string) {
    const existing = await this.findQrByFoodTruck(foodTruckId);

    if (existing) {
      return existing;
    }

    return this.prisma.truckQrCode.create({
      data: {
        foodTruckId,
        code: this.createQrCode(),
      },
    });
  }

  async ensureQrCodesForVendor(vendorId: string) {
    const trucks = await this.prisma.foodTruck.findMany({
      where: {
        vendorId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const qrCodes: any[] = [];
    for (const truck of trucks) {
      qrCodes.push(await this.ensureTruckQrCode(truck.id));
    }

    return qrCodes;
  }

  async recordScan(
    qrCodeId: string,
    foodTruckId: string,
    userId: string | undefined,
    dto: ScanQrDto,
  ) {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO qr_scans (
          qr_code_id,
          food_truck_id,
          user_id,
          anonymous_session_id,
          scan_location,
          opened_profile
        )
        VALUES (
          ${qrCodeId}::uuid,
          ${foodTruckId}::uuid,
          ${userId ?? null}::uuid,
          ${dto.anonymousSessionId ?? null},
          ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
          ${dto.openedProfile ?? true}
        )
        RETURNING id
      `;

      return this.prisma.qrScan.findUnique({
        where: { id: rows[0].id },
        include: { foodTruck: true },
      });
    }

    return this.prisma.qrScan.create({
      data: {
        qrCodeId,
        foodTruckId,
        userId,
        anonymousSessionId: dto.anonymousSessionId,
        openedProfile: dto.openedProfile ?? true,
      },
      include: { foodTruck: true },
    });
  }

  findQrScanById(qrScanId: string) {
    return this.prisma.qrScan.findUnique({
      where: { id: qrScanId },
    });
  }

  findRecentCheckIn(userId: string, foodTruckId: string, since: Date) {
    return this.prisma.checkIn.findFirst({
      where: {
        userId,
        foodTruckId,
        checkedInAt: { gte: since },
        status: { in: ['PENDING', 'VERIFIED'] },
      },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  calculateDistanceFromTruck(foodTruckId: string, dto: CreateCheckInDto) {
    return this.prisma.$queryRaw<DistanceRow[]>`
      SELECT
        ST_Distance(
          current_location,
          ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
        ) AS "distanceMeters"
      FROM food_trucks
      WHERE id = ${foodTruckId}::uuid
        AND current_location IS NOT NULL
      LIMIT 1
    `;
  }

  async createCheckIn(
    userId: string,
    foodTruckId: string,
    dto: CreateCheckInDto,
    verification: {
      status: 'VERIFIED' | 'REJECTED';
      distanceMeters: number | null;
      locationVerified: boolean;
      rejectionReason?: string;
      fraudScore: number;
    },
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO check_ins (
        user_id,
        food_truck_id,
        qr_scan_id,
        status,
        verification_method,
        user_location,
        distance_meters,
        location_accuracy_meters,
        device_id,
        fraud_score,
        location_verified,
        rejection_reason,
        verified_at
      )
      VALUES (
        ${userId}::uuid,
        ${foodTruckId}::uuid,
        ${dto.qrScanId ?? null}::uuid,
        ${verification.status}::"CheckInStatus",
        'QR_LOCATION',
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        ${verification.distanceMeters},
        ${dto.locationAccuracyMeters ?? null},
        ${dto.deviceId ?? null},
        ${verification.fraudScore},
        ${verification.locationVerified},
        ${verification.rejectionReason ?? null},
        ${verification.locationVerified ? new Date() : null}
      )
      RETURNING id
    `;

    if (dto.qrScanId) {
      await this.prisma.qrScan.update({
        where: { id: dto.qrScanId },
        data: { completedCheckIn: verification.status === 'VERIFIED' },
      });
    }

    if (verification.status === 'VERIFIED') {
      await this.prisma.foodTruck.update({
        where: { id: foodTruckId },
        data: { totalCheckIns: { increment: 1 } },
      });
    }

    return this.prisma.checkIn.findUnique({
      where: { id: rows[0].id },
      include: {
        foodTruck: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        qrScan: true,
      },
    });
  }

  async createDuplicateCheckIn(
    userId: string,
    foodTruckId: string,
    dto: CreateCheckInDto,
  ) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO check_ins (
        user_id,
        food_truck_id,
        qr_scan_id,
        status,
        verification_method,
        user_location,
        location_accuracy_meters,
        device_id,
        fraud_score,
        location_verified,
        rejection_reason
      )
      VALUES (
        ${userId}::uuid,
        ${foodTruckId}::uuid,
        ${dto.qrScanId ?? null}::uuid,
        'DUPLICATE'::"CheckInStatus",
        'QR_LOCATION',
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        ${dto.locationAccuracyMeters ?? null},
        ${dto.deviceId ?? null},
        100,
        false,
        'Duplicate check-in window'
      )
      RETURNING id
    `;

    return this.prisma.checkIn.findUnique({
      where: { id: rows[0].id },
      include: {
        foodTruck: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  getQrAnalytics(foodTruckId: string) {
    return this.prisma.$transaction([
      this.prisma.qrScan.count({ where: { foodTruckId } }),
      this.prisma.qrScan.count({
        where: { foodTruckId, completedCheckIn: true },
      }),
      this.prisma.checkIn.count({ where: { foodTruckId } }),
      this.prisma.checkIn.count({
        where: { foodTruckId, status: 'VERIFIED' },
      }),
      this.prisma.qrScan.findMany({
        where: { foodTruckId },
        orderBy: { scannedAt: 'desc' },
        take: 10,
      }),
    ]);
  }

  private createQrCode() {
    return `truck_${randomBytes(18).toString('base64url')}`;
  }
}
