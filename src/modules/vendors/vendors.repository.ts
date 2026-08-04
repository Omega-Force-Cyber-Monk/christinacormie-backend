import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateVendorProfileDto } from './dto/update-vendor-profile.dto';

@Injectable()
export class VendorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      include: this.vendorInclude(),
    });
  }

  findById(id: string) {
    return this.prisma.vendor.findUnique({
      where: { id },
      include: this.vendorInclude(),
    });
  }

  findPendingApproval() {
    return this.prisma.vendor.findMany({
      where: { status: 'PENDING_APPROVAL', deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: this.vendorInclude(),
    });
  }

  updateProfile(vendorId: string, dto: UpdateVendorProfileDto) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
      include: this.vendorInclude(),
    });
  }

  submitVerificationRequest(vendorId: string, documents: unknown, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const verificationRequest = await tx.vendorVerificationRequest.create({
        data: {
          vendorId,
          documents: documents as any,
          notes,
          status: 'PENDING',
        },
      });

      const vendor = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'PENDING_APPROVAL',
          updatedAt: new Date(),
        },
        include: this.vendorInclude(),
      });

      return {
        vendor,
        verificationRequest,
      };
    });
  }

  approve(vendorId: string, adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.vendorVerificationRequest.updateMany({
        where: {
          vendorId,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedById: adminUserId,
          reviewedAt: new Date(),
        },
      });

      return tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'APPROVED',
          isVerified: true,
          verifiedAt: new Date(),
          approvedById: adminUserId,
          approvedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        },
        include: this.vendorInclude(),
      });
    });
  }

  reject(vendorId: string, adminUserId: string, rejectionReason: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.vendorVerificationRequest.updateMany({
        where: {
          vendorId,
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewedById: adminUserId,
          reviewedAt: new Date(),
          rejectionReason,
        },
      });

      return tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: 'REJECTED',
          isVerified: false,
          rejectionReason,
          updatedAt: new Date(),
        },
        include: this.vendorInclude(),
      });
    });
  }

  private vendorInclude() {
    return {
      user: {
        include: {
          profile: true,
          userRoles: true,
        },
      },
      market: true,
      verificationRequests: {
        orderBy: { createdAt: 'desc' as const },
      },
      foodTrucks: true,
    };
  }
}
