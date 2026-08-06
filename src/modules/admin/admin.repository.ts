import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpsertLeaderboardRuleDto } from './dto/upsert-leaderboard-rule.dto';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(query: AdminListQueryDto) {
    return this.prisma.user.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' as const } },
                { phone: { contains: query.search, mode: 'insensitive' as const } },
                {
                  profile: {
                    displayName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        profile: true,
        userRoles: true,
        vendor: {
          select: {
            id: true,
            businessName: true,
            status: true,
            isVerified: true,
          },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  getUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        settings: true,
        notificationPreference: true,
        userRoles: true,
        loyaltyAccount: true,
        vendor: true,
      },
    });
  }

  listVendors(query: AdminListQueryDto) {
    return this.prisma.vendor.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  businessName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  businessEmail: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        foodTrucks: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  getVendor(vendorId: string) {
    return this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
          },
        },
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
        },
        foodTrucks: {
          select: this.foodTruckSelect(),
        },
        paymentAccount: true,
        vendorBadges: {
          where: { revokedAt: null },
          include: { badge: true },
        },
      },
    });
  }

  listVerificationRequests(query: AdminListQueryDto) {
    return this.prisma.vendorVerificationRequest.findMany({
      where: query.status ? { status: query.status as any } : {},
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
            status: true,
            isVerified: true,
            user: {
              select: {
                id: true,
                email: true,
                status: true,
              },
            },
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  listFoodTrucks(query: AdminListQueryDto) {
    return this.prisma.foodTruck.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' as const } },
                { slug: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: this.foodTruckSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  getFoodTruck(foodTruckId: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id: foodTruckId },
      select: {
        ...this.foodTruckSelect(),
        images: true,
        cuisines: { include: { cuisine: true } },
        serviceAreas: {
          select: {
            id: true,
            name: true,
            centerAddress: true,
            radiusKm: true,
            outsideRadiusAllowed: true,
            outsideRadiusFee: true,
            isActive: true,
          },
        },
        menus: {
          include: {
            categories: {
              include: { items: true },
            },
          },
        },
      },
    });
  }

  updateFoodTruck(foodTruckId: string, dto: UpdateFoodTruckAdminDto) {
    return this.prisma.foodTruck.update({
      where: { id: foodTruckId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        updatedAt: new Date(),
      },
      select: this.foodTruckSelect(),
    });
  }

  listBookings(query: AdminListQueryDto) {
    return this.prisma.booking.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  bookingNumber: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  eventName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      select: this.bookingSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  getBooking(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        ...this.bookingSelect(),
        quotes: true,
        payments: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  listPayments(query: AdminListQueryDto) {
    return this.prisma.payment.findMany({
      where: query.status ? { status: query.status as any } : {},
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
          },
        },
        commission: true,
        refunds: true,
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  listCommissions(query: AdminListQueryDto) {
    return this.prisma.commission.findMany({
      include: {
        payment: true,
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            status: true,
          },
        },
        vendor: {
          select: {
            id: true,
            businessName: true,
          },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  listRefunds(query: AdminListQueryDto) {
    return this.prisma.refund.findMany({
      where: query.status ? { status: query.status as any } : {},
      include: {
        payment: {
          include: {
            booking: {
              select: {
                id: true,
                bookingNumber: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { processedAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  listReviews(query: AdminListQueryDto) {
    return this.prisma.review.findMany({
      where: query.status ? { status: query.status as any } : {},
      include: {
        customer: { select: { id: true, email: true, profile: true } },
        vendor: { select: { id: true, businessName: true } },
        foodTruck: { select: { id: true, name: true, slug: true } },
        reports: true,
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  listCommunityRequests(query: AdminListQueryDto) {
    return this.prisma.communityRequest.findMany({
      where: {
        ...(query.status ? { status: query.status as any } : {}),
        ...(query.search
          ? {
              title: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      select: this.communityRequestSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  moderateCommunityRequest(
    requestId: string,
    dto: ModerateCommunityRequestDto,
  ) {
    return this.prisma.communityRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
        ...(dto.deletedAt !== undefined
          ? { deletedAt: dto.deletedAt ? new Date(dto.deletedAt) : null }
          : {}),
      },
      select: this.communityRequestSelect(),
    });
  }

  deleteCommunityComment(commentId: string) {
    return this.prisma.communityRequestComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
  }

  listMarkets() {
    return this.prisma.market.findMany({
      select: this.marketSelect(),
      orderBy: [{ country: 'asc' }, { state: 'asc' }, { city: 'asc' }],
    });
  }

  createMarket(dto: CreateMarketDto) {
    return this.prisma.market.create({
      data: {
        name: dto.name,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'USA',
        timezone: dto.timezone,
        operatingRadiusKm: dto.operatingRadiusKm,
        status: dto.status as any,
      },
      select: this.marketSelect(),
    });
  }

  updateMarket(marketId: string, dto: UpdateMarketDto) {
    return this.prisma.market.update({
      where: { id: marketId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.operatingRadiusKm !== undefined
          ? { operatingRadiusKm: dto.operatingRadiusKm }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status as any } : {}),
      },
      select: this.marketSelect(),
    });
  }

  listPlatformSettings() {
    return this.prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  upsertPlatformSetting(
    key: string,
    adminUserId: string,
    dto: UpsertPlatformSettingDto,
  ) {
    return this.prisma.platformSetting.upsert({
      where: { key },
      create: {
        key,
        value: dto.value as any,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        updatedById: adminUserId,
      },
      update: {
        value: dto.value as any,
        description: dto.description,
        isPublic: dto.isPublic,
        updatedById: adminUserId,
      },
    });
  }

  listLeaderboardRules() {
    return this.prisma.leaderboardRule.findMany({
      orderBy: [{ type: 'asc' }, { period: 'asc' }],
    });
  }

  createLeaderboardRule(dto: UpsertLeaderboardRuleDto) {
    return this.prisma.leaderboardRule.create({
      data: this.leaderboardRuleData(dto),
    });
  }

  updateLeaderboardRule(ruleId: string, dto: UpsertLeaderboardRuleDto) {
    return this.prisma.leaderboardRule.update({
      where: { id: ruleId },
      data: this.leaderboardRuleData(dto),
    });
  }

  listLeaderboards(query: AdminListQueryDto) {
    return this.prisma.leaderboard.findMany({
      where: query.status ? { isActive: query.status === 'ACTIVE' } : {},
      include: {
        market: { select: this.marketSelect() },
        rule: true,
        entries: {
          orderBy: { rank: 'asc' },
          take: 20,
          include: {
            vendor: { select: { id: true, businessName: true } },
            foodTruck: { select: { id: true, name: true, slug: true } },
          },
        },
      },
      orderBy: { startsAt: 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  private limit(query: AdminListQueryDto) {
    return Math.min(query.limit ?? 20, 100);
  }

  private foodTruckSelect() {
    return {
      id: true,
      vendorId: true,
      marketId: true,
      name: true,
      slug: true,
      description: true,
      profileImageUrl: true,
      coverImageUrl: true,
      status: true,
      operatingStatus: true,
      minimumBookingAmount: true,
      maximumGuestCapacity: true,
      currentAddress: true,
      locationUpdatedAt: true,
      locationValidUntil: true,
      averageRating: true,
      totalReviews: true,
      totalBookings: true,
      totalCheckIns: true,
      followerCount: true,
      isFeatured: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      vendor: {
        select: {
          id: true,
          businessName: true,
          status: true,
          isVerified: true,
        },
      },
      market: {
        select: this.marketSelect(),
      },
    };
  }

  private bookingSelect() {
    return {
      id: true,
      bookingNumber: true,
      customerId: true,
      vendorId: true,
      foodTruckId: true,
      bookingType: true,
      status: true,
      eventName: true,
      startsAt: true,
      endsAt: true,
      guestCount: true,
      address: true,
      subtotal: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { id: true, email: true, profile: true } },
      vendor: { select: { id: true, businessName: true } },
      foodTruck: { select: { id: true, name: true, slug: true } },
    };
  }

  private communityRequestSelect() {
    return {
      id: true,
      createdById: true,
      targetFoodTruckId: true,
      visibility: true,
      requestType: true,
      status: true,
      title: true,
      description: true,
      eventDate: true,
      guestCount: true,
      budgetMin: true,
      budgetMax: true,
      address: true,
      allowPublicComments: true,
      expiresAt: true,
      createdAt: true,
      deletedAt: true,
      createdBy: { select: { id: true, email: true, profile: true } },
      targetFoodTruck: { select: { id: true, name: true, slug: true } },
      media: true,
      comments: {
        where: { deletedAt: null },
        take: 20,
        orderBy: { createdAt: 'desc' as const },
      },
      vendorOffers: true,
    };
  }

  private marketSelect() {
    return {
      id: true,
      name: true,
      city: true,
      state: true,
      country: true,
      timezone: true,
      operatingRadiusKm: true,
      status: true,
      createdAt: true,
    };
  }

  private leaderboardRuleData(dto: UpsertLeaderboardRuleDto) {
    return {
      type: dto.type as any,
      period: dto.period as any,
      bookingWeight: dto.bookingWeight ?? 0,
      ratingWeight: dto.ratingWeight ?? 0,
      reliabilityWeight: dto.reliabilityWeight ?? 0,
      engagementWeight: dto.engagementWeight ?? 0,
      checkInWeight: dto.checkInWeight ?? 0,
      minimumCompletedBookings: dto.minimumCompletedBookings ?? 0,
      algorithmVersion: dto.algorithmVersion,
      isActive: dto.isActive ?? true,
    };
  }

  async getOverviewAnalytics() {
    const [
      usersCount,
      vendorsByStatus,
      foodTrucksByStatus,
      bookingsByStatus,
      successfulPayments,
      commissionsSum,
      refundsSum,
      reviewsAgg,
      communityRequestCount,
      checkInCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.vendor.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
      this.prisma.foodTruck.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.commission.aggregate({
        _sum: { commissionAmount: true },
      }),
      this.prisma.refund.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.review.aggregate({
        where: { status: 'PUBLISHED' },
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.communityRequest.count({
        where: { deletedAt: null },
      }),
      this.prisma.checkIn.count(),
    ]);

    return {
      usersCount,
      vendorsCountByStatus: vendorsByStatus.map((v) => ({
        status: v.status,
        count: v._count.id,
      })),
      foodTrucksCountByStatus: foodTrucksByStatus.map((ft) => ({
        status: ft.status,
        count: ft._count.id,
      })),
      bookingsCountByStatus: bookingsByStatus.map((b) => ({
        status: b.status,
        count: b._count.id,
      })),
      successfulPaymentTotals: Number(successfulPayments._sum.amount ?? 0),
      commissionTotals: Number(commissionsSum._sum.commissionAmount ?? 0),
      refundTotals: Number(refundsSum._sum.amount ?? 0),
      reviews: {
        count: reviewsAgg._count,
        averageRating: Math.round(Number(reviewsAgg._avg?.rating ?? 0) * 100) / 100,
      },
      communityRequestCount,
      checkInCount,
    };
  }

  async getBookingsAnalytics() {
    const [
      totalBookings,
      bookingsByStatus,
      bookingsByType,
      totalBookingAmount,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.booking.groupBy({
        by: ['bookingType'],
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
    ]);

    const totalValue = Number(totalBookingAmount._sum.totalAmount ?? 0);
    const averageValue = Math.round(Number(totalBookingAmount._avg.totalAmount ?? 0) * 100) / 100;

    return {
      totalBookings,
      totalBookingValue: totalValue,
      averageBookingValue: averageValue,
      bookingsByStatus: bookingsByStatus.map((b) => ({
        status: b.status,
        count: b._count.id,
        totalAmount: Number(b._sum.totalAmount ?? 0),
      })),
      bookingsByType: bookingsByType.map((b) => ({
        type: b.bookingType,
        count: b._count.id,
        totalAmount: Number(b._sum.totalAmount ?? 0),
      })),
    };
  }

  async getPaymentsAnalytics() {
    const [
      totalPaymentsCount,
      paymentsByStatus,
      successfulPayments,
      commissionsAgg,
      refundsAgg,
    ] = await Promise.all([
      this.prisma.payment.count(),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.prisma.commission.aggregate({
        _sum: { commissionAmount: true },
        _avg: { commissionRate: true },
      }),
      this.prisma.refund.aggregate({
        _sum: { amount: true },
      }),
    ]);

    return {
      totalPaymentsCount,
      successfulPaymentTotal: Number(successfulPayments._sum.amount ?? 0),
      commissionTotals: Number(commissionsAgg._sum.commissionAmount ?? 0),
      averageCommissionRate: Math.round(Number(commissionsAgg._avg.commissionRate ?? 0) * 10000) / 10000,
      refundTotals: Number(refundsAgg._sum.amount ?? 0),
      paymentsByStatus: paymentsByStatus.map((p) => ({
        status: p.status,
        count: p._count.id,
        totalAmount: Number(p._sum.amount ?? 0),
      })),
    };
  }

  async getVendorsAnalytics() {
    const [
      totalVendors,
      vendorsByStatus,
      verifiedVendorsCount,
      foodTrucksByStatus,
      foodTrucksByOperatingStatus,
      vendorReliabilityAgg,
    ] = await Promise.all([
      this.prisma.vendor.count({ where: { deletedAt: null } }),
      this.prisma.vendor.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
      this.prisma.vendor.count({
        where: { isVerified: true, deletedAt: null },
      }),
      this.prisma.foodTruck.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
      this.prisma.foodTruck.groupBy({
        by: ['operatingStatus'],
        _count: { id: true },
        where: { deletedAt: null },
      }),
      this.prisma.vendor.aggregate({
        where: { deletedAt: null },
        _avg: { reliabilityScore: true },
      }),
    ]);

    return {
      totalVendors,
      verifiedVendorsCount,
      averageVendorReliability: Math.round(Number(vendorReliabilityAgg._avg.reliabilityScore ?? 0) * 100) / 100,
      vendorsByStatus: vendorsByStatus.map((v) => ({
        status: v.status,
        count: v._count.id,
      })),
      foodTrucksByStatus: foodTrucksByStatus.map((ft) => ({
        status: ft.status,
        count: ft._count.id,
      })),
      foodTrucksByOperatingStatus: foodTrucksByOperatingStatus.map((ft) => ({
        operatingStatus: ft.operatingStatus,
        count: ft._count.id,
      })),
    };
  }

  createAuditLog(
    adminUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    return (this.prisma as any).adminAuditLog.create({
      data: {
        adminUserId,
        action,
        entityType,
        entityId,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });
  }
}
