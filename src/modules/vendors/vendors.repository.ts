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

      await (tx as any).adminAuditLog.create({
        data: {
          adminUserId,
          action: 'APPROVE_VENDOR',
          entityType: 'Vendor',
          entityId: vendorId,
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

      await (tx as any).adminAuditLog.create({
        data: {
          adminUserId,
          action: 'REJECT_VENDOR',
          entityType: 'Vendor',
          entityId: vendorId,
          metadata: { rejectionReason },
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

  async getVendorAnalytics(vendorId: string) {
    const [
      totalFoodTrucks,
      totalBookings,
      succeededPayments,
      allPayments,
      reviewsAggregate,
      trucksAggregate,
      recentBookings,
      topTrucks,
    ] = await Promise.all([
      this.prisma.foodTruck.count({
        where: { vendorId, deletedAt: null },
      }),
      this.prisma.booking.count({
        where: { vendorId },
      }),
      this.prisma.payment.aggregate({
        where: { vendorId, status: 'SUCCEEDED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { vendorId },
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.review.aggregate({
        where: { vendorId, status: 'PUBLISHED' },
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.foodTruck.aggregate({
        where: { vendorId, deletedAt: null },
        _sum: {
          followerCount: true,
          totalCheckIns: true,
        },
      }),
      this.prisma.booking.findMany({
        where: { vendorId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          bookingNumber: true,
          bookingType: true,
          status: true,
          totalAmount: true,
          startsAt: true,
          createdAt: true,
          customer: {
            select: { id: true, email: true, profile: true },
          },
          foodTruck: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      this.prisma.foodTruck.findMany({
        where: { vendorId, deletedAt: null },
        orderBy: [{ totalBookings: 'desc' }, { averageRating: 'desc' }],
        take: 5,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          averageRating: true,
          totalReviews: true,
          totalBookings: true,
          totalCheckIns: true,
          followerCount: true,
        },
      }),
    ]);

    const totalRevenue = Number(succeededPayments._sum.amount ?? 0);
    const totalReviews = reviewsAggregate._count;
    const averageRating = Math.round(Number(reviewsAggregate._avg?.rating ?? 0) * 100) / 100;
    const totalFollowers = trucksAggregate._sum.followerCount ?? 0;
    const totalCheckIns = trucksAggregate._sum.totalCheckIns ?? 0;

    const paymentSummary = allPayments.map((p) => ({
      status: p.status,
      count: p._count.id,
      totalAmount: Number(p._sum.amount ?? 0),
    }));

    return {
      totalFoodTrucks,
      totalBookings,
      totalRevenue,
      totalReviews,
      averageRating,
      totalFollowers,
      totalCheckIns,
      recentBookings,
      paymentSummary,
      topTrucks,
    };
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
