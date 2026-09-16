import { Injectable } from '@nestjs/common';
import {
  MenuItemStatus,
  PaymentStatus,
  ReportStatus,
  VendorStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { CreateMarketDto } from './dto/create-market.dto';
import { ModerateCommunityRequestDto } from './dto/moderate-community-request.dto';
import { UpdateNewFoodTruckRequestDto } from './dto/update-new-food-truck-request.dto';
import { UpdateFoodTruckAdminDto } from './dto/update-food-truck-admin.dto';
import { UpdateMarketDto } from './dto/update-market.dto';
import { UpdateVerificationDocumentDto } from './dto/update-verification-document.dto';
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
                {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  phone: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
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
      where: this.vendorWhere(query),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            status: true,
            profile: true,
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
            averageRating: true,
            totalReviews: true,
            followerCount: true,
            cuisines: { include: { cuisine: true } },
          },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  async getVendorsManagement(query: AdminListQueryDto) {
    const where = this.vendorWhere(query);

    const [
      totalVendors,
      activeVendors,
      pendingApproval,
      suspended,
      truckRequestsCount,
      communicatedCount,
      photoShootRequestCount,
      vendors,
    ] = await Promise.all([
      this.prisma.vendor.count({ where: { deletedAt: null } }),
      this.prisma.vendor.count({
        where: { deletedAt: null, status: VendorStatus.APPROVED },
      }),
      this.prisma.vendor.count({
        where: { deletedAt: null, status: VendorStatus.PENDING_APPROVAL },
      }),
      this.prisma.vendor.count({
        where: { deletedAt: null, status: VendorStatus.SUSPENDED },
      }),
      this.prisma.newFoodTruckRequest.count(),
      this.prisma.newFoodTruckRequest.count({
        where: { status: 'COMMUNICATED' },
      }),
      this.prisma.vendorPhotoShootRequest.count(),
      this.prisma.vendor.findMany({
        where,
        select: this.vendorManagementSelect(),
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        take: this.limit(query),
        skip: query.offset ?? 0,
      }),
    ]);

    return {
      summary: {
        totalVendors,
        active: activeVendors,
        pendingApproval,
        suspended,
      },
      tabs: {
        allVendors: totalVendors,
        truckRequests: truckRequestsCount,
        communicated: communicatedCount,
        photoShootRequests: photoShootRequestCount,
      },
      vendors: vendors.map((vendor) => this.toVendorManagementRow(vendor)),
    };
  }

  getVendor(vendorId: string) {
    return this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: this.vendorManagementSelect(),
    });
  }

  listNewFoodTruckRequests(query: AdminListQueryDto) {
    return this.prisma.newFoodTruckRequest.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                {
                  truckName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  ownerName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  ownerEmail: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  city: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        requestedBy: {
          select: { id: true, email: true, phone: true, profile: true },
        },
        reviewedBy: {
          select: { id: true, email: true, profile: true },
        },
      },
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  updateNewFoodTruckRequest(
    requestId: string,
    adminUserId: string,
    dto: UpdateNewFoodTruckRequestDto,
  ) {
    return this.prisma.newFoodTruckRequest.update({
      where: { id: requestId },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        reviewedById: adminUserId,
        reviewedAt: new Date(),
      },
      include: {
        requestedBy: {
          select: { id: true, email: true, phone: true, profile: true },
        },
        reviewedBy: {
          select: { id: true, email: true, profile: true },
        },
      },
    });
  }

  updateVendorStatus(vendorId: string, status: string) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        status: status as any,
        updatedAt: new Date(),
      },
      select: this.vendorManagementSelect(),
    });
  }

  async removeVendorBadge(vendorId: string, badgeId: string) {
    const badge = await this.prisma.vendorBadge.findUnique({
      where: { vendorId_badgeId: { vendorId, badgeId } },
    });

    if (!badge || badge.revokedAt) {
      return null;
    }

    return this.prisma.vendorBadge.update({
      where: { vendorId_badgeId: { vendorId, badgeId } },
      data: { revokedAt: new Date() },
      include: { badge: true },
    });
  }

  async updateVerificationDocument(
    requestId: string,
    documentKey: string,
    adminUserId: string,
    dto: UpdateVerificationDocumentDto,
  ) {
    const request = await this.prisma.vendorVerificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request || !Array.isArray(request.documents)) {
      return null;
    }

    let found = false;
    const documents = request.documents.map((document) => {
      if (!this.matchesDocumentKey(document, documentKey)) {
        return document;
      }

      found = true;

      return {
        ...(document as Record<string, unknown>),
        status: dto.status,
        reviewedById: adminUserId,
        reviewedAt: new Date().toISOString(),
        ...(dto.rejectionReason !== undefined
          ? { rejectionReason: dto.rejectionReason }
          : {}),
      };
    });

    if (!found) {
      return null;
    }

    return this.prisma.vendorVerificationRequest.update({
      where: { id: requestId },
      data: { documents: documents as any },
      include: {
        vendor: {
          select: {
            id: true,
            businessName: true,
            status: true,
            isVerified: true,
          },
        },
      },
    });
  }

  listVerificationRequests(query: AdminListQueryDto) {
    const status = this.toVerificationStatus(query.status);

    return this.prisma.vendorVerificationRequest.findMany({
      where: status ? { status } : {},
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
                {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  slug: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
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
      where: this.bookingWhere(query),
      select: this.bookingSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  async getBookingsManagement(query: AdminListQueryDto) {
    const now = new Date();
    const currentMonthStart = this.startOfMonth(now);
    const nextMonthStart = this.addMonths(currentMonthStart, 1);
    const where = this.bookingWhere(query);

    const [totalBookings, thisMonth, totalRevenue, disputed, bookings] =
      await Promise.all([
        this.prisma.booking.count(),
        this.prisma.booking.count({
          where: { createdAt: { gte: currentMonthStart, lt: nextMonthStart } },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCEEDED' },
          _sum: { amount: true },
        }),
        this.prisma.reviewReport.count({
          where: { status: { in: ['PENDING', 'REVIEWING'] } },
        }),
        this.prisma.booking.findMany({
          where,
          select: this.bookingManagementSelect(),
          orderBy: { createdAt: query.sortOrder ?? 'desc' },
          take: this.limit(query),
          skip: query.offset ?? 0,
        }),
      ]);

    return {
      generatedAt: now,
      summary: {
        totalBookings,
        thisMonth,
        totalRevenue: Number(totalRevenue._sum.amount ?? 0),
        disputed,
        disputedSource: 'review_reports',
      },
      bookings: bookings.map((booking) => this.toBookingManagementRow(booking)),
    };
  }

  getBooking(bookingId: string) {
    return this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        ...this.bookingManagementSelect(),
        eventDescription: true,
        contactPhone: true,
        budgetAmount: true,
        paymentPreference: true,
        preferredMenuItemIds: true,
        customMenuItems: true,
        referenceImageUrls: true,
        specialInstructions: true,
        isAdultConfirmed: true,
        termsAccepted: true,
        acceptedAt: true,
        confirmedAt: true,
        completedAt: true,
        cancelledAt: true,
        cancellationReason: true,
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

  async getDashboard() {
    const now = new Date();
    const currentMonthStart = this.startOfMonth(now);
    const nextMonthStart = this.addMonths(currentMonthStart, 1);
    const previousMonthStart = this.addMonths(currentMonthStart, -1);
    const sixMonthStarts = Array.from({ length: 6 }, (_, index) =>
      this.addMonths(currentMonthStart, index - 5),
    );

    const [
      totalUsers,
      previousTotalUsers,
      activeVendors,
      previousActiveVendors,
      liveDrops,
      previousLiveDrops,
      monthlyBookings,
      previousMonthlyBookings,
      monthlyRevenueAgg,
      previousMonthlyRevenueAgg,
      monthlyCommissionAgg,
      previousMonthlyCommissionAgg,
      pendingPayouts,
      previousPendingPayouts,
      activeReviewReports,
      previousActiveReviewReports,
      revenueTrend,
      bookingsTrend,
      recentActivity,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { lt: currentMonthStart } },
      }),
      this.prisma.vendor.count({
        where: { deletedAt: null, status: 'APPROVED' },
      }),
      this.prisma.vendor.count({
        where: {
          deletedAt: null,
          status: 'APPROVED',
          createdAt: { lt: currentMonthStart },
        },
      }),
      this.prisma.foodTruckDrop.count({
        where: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      }),
      this.prisma.foodTruckDrop.count({
        where: {
          status: 'ACTIVE',
          startsAt: { lte: currentMonthStart },
          OR: [{ endsAt: null }, { endsAt: { gte: currentMonthStart } }],
        },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: currentMonthStart, lt: nextMonthStart } },
      }),
      this.prisma.booking.count({
        where: {
          createdAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          paidAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: 'SUCCEEDED',
          paidAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.commission.aggregate({
        where: { createdAt: { gte: currentMonthStart, lt: nextMonthStart } },
        _sum: { commissionAmount: true },
      }),
      this.prisma.commission.aggregate({
        where: {
          createdAt: { gte: previousMonthStart, lt: currentMonthStart },
        },
        _sum: { commissionAmount: true },
      }),
      this.prisma.payout.count({ where: { status: 'PENDING' } }),
      this.prisma.payout.count({
        where: { status: 'PENDING', createdAt: { lt: currentMonthStart } },
      }),
      this.prisma.reviewReport.count({
        where: { status: { in: ['PENDING', 'REVIEWING'] } },
      }),
      this.prisma.reviewReport.count({
        where: {
          status: { in: ['PENDING', 'REVIEWING'] },
          createdAt: { lt: currentMonthStart },
        },
      }),
      Promise.all(
        sixMonthStarts.map(async (monthStart) => {
          const nextStart = this.addMonths(monthStart, 1);
          const aggregate = await this.prisma.payment.aggregate({
            where: {
              status: 'SUCCEEDED',
              paidAt: { gte: monthStart, lt: nextStart },
            },
            _sum: { amount: true },
          });

          return {
            month: this.monthLabel(monthStart),
            revenue: Number(aggregate._sum.amount ?? 0),
          };
        }),
      ),
      Promise.all(
        sixMonthStarts.map(async (monthStart) => {
          const nextStart = this.addMonths(monthStart, 1);
          const count = await this.prisma.booking.count({
            where: { createdAt: { gte: monthStart, lt: nextStart } },
          });

          return {
            month: this.monthLabel(monthStart),
            bookings: count,
          };
        }),
      ),
      this.getRecentDashboardActivity(),
    ]);

    const monthlyRevenue = Number(monthlyRevenueAgg._sum.amount ?? 0);
    const previousMonthlyRevenue = Number(
      previousMonthlyRevenueAgg._sum.amount ?? 0,
    );
    const monthlyCommission = Number(
      monthlyCommissionAgg._sum.commissionAmount ?? 0,
    );
    const previousMonthlyCommission = Number(
      previousMonthlyCommissionAgg._sum.commissionAmount ?? 0,
    );

    return {
      generatedAt: now,
      cards: {
        totalUsers: this.metric(totalUsers, previousTotalUsers),
        activeVendors: this.metric(activeVendors, previousActiveVendors),
        liveDrops: this.metric(liveDrops, previousLiveDrops),
        monthlyBookings: this.metric(monthlyBookings, previousMonthlyBookings),
        revenueThisMonth: this.metric(monthlyRevenue, previousMonthlyRevenue),
        commissionEarned: this.metric(
          monthlyCommission,
          previousMonthlyCommission,
        ),
        pendingPayouts: this.metric(pendingPayouts, previousPendingPayouts),
        activeDisputes: {
          ...this.metric(activeReviewReports, previousActiveReviewReports),
          source: 'review_reports',
        },
      },
      charts: {
        revenueTrend,
        monthlyBookings: bookingsTrend,
      },
      recentActivity,
    };
  }

  private limit(query: AdminListQueryDto) {
    return Math.min(query.limit ?? 20, 100);
  }

  private vendorWhere(query: AdminListQueryDto) {
    return {
      deletedAt: null,
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
              {
                businessPhone: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                user: {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                user: {
                  profile: {
                    displayName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                foodTrucks: {
                  some: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private bookingWhere(query: AdminListQueryDto) {
    return {
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
              {
                address: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                customer: {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                customer: {
                  phone: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                customer: {
                  profile: {
                    displayName: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
              {
                vendor: {
                  businessName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                vendor: {
                  businessEmail: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                foodTruck: {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async getRecentDashboardActivity() {
    const [bookings, payouts, reviewReports, verificationRequests] =
      await Promise.all([
        this.prisma.booking.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            bookingNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            customer: { select: { email: true, profile: true } },
          },
        }),
        this.prisma.payout.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
            vendor: { select: { businessName: true } },
          },
        }),
        this.prisma.reviewReport.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            reason: true,
            createdAt: true,
            reportedBy: { select: { email: true, profile: true } },
            review: {
              select: {
                id: true,
                foodTruck: { select: { name: true } },
              },
            },
          },
        }),
        this.prisma.vendorVerificationRequest.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            createdAt: true,
            vendor: { select: { businessName: true } },
          },
        }),
      ]);

    return [
      ...bookings.map((booking) => ({
        id: booking.id,
        type: 'booking',
        title: `${this.userDisplayName(booking.customer)} created booking`,
        subtitle: `${booking.bookingNumber} · $${Number(
          booking.totalAmount ?? 0,
        ).toFixed(2)}`,
        status: booking.status,
        createdAt: booking.createdAt,
      })),
      ...payouts.map((payout) => ({
        id: payout.id,
        type: 'payout',
        title: `${payout.vendor.businessName} requested payout`,
        subtitle: `$${Number(payout.amount ?? 0).toFixed(2)}`,
        status: payout.status,
        createdAt: payout.createdAt,
      })),
      ...reviewReports.map((report) => ({
        id: report.id,
        type: 'review_report',
        title: `${this.userDisplayName(report.reportedBy)} reported review`,
        subtitle: `${report.reason} · ${
          report.review.foodTruck?.name ?? 'Food truck'
        }`,
        status: report.status,
        createdAt: report.createdAt,
      })),
      ...verificationRequests.map((request) => ({
        id: request.id,
        type: 'vendor_verification',
        title: `${request.vendor.businessName} submitted vendor application`,
        subtitle: 'Vendor verification',
        status: request.status,
        createdAt: request.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);
  }

  private metric(value: number, previousValue: number) {
    return {
      value,
      previousValue,
      changePercent: this.changePercent(value, previousValue),
    };
  }

  private changePercent(value: number, previousValue: number) {
    if (previousValue === 0) {
      return value === 0 ? 0 : 100;
    }

    return Math.round(((value - previousValue) / previousValue) * 1000) / 10;
  }

  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private addMonths(date: Date, months: number) {
    return new Date(date.getFullYear(), date.getMonth() + months, 1);
  }

  private monthLabel(date: Date) {
    return date.toLocaleString('en-US', { month: 'short' });
  }

  private userDisplayName(user: {
    email: string | null;
    profile: {
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }) {
    const profileName =
      user.profile?.displayName ??
      [user.profile?.firstName, user.profile?.lastName]
        .filter(Boolean)
        .join(' ');

    return profileName || user.email || 'User';
  }

  private toVerificationStatus(
    status?: string,
  ): VerificationStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalizedStatus = status.trim().toUpperCase();

    if (
      normalizedStatus === VerificationStatus.PENDING ||
      normalizedStatus === VerificationStatus.APPROVED ||
      normalizedStatus === VerificationStatus.REJECTED
    ) {
      return normalizedStatus;
    }

    return undefined;
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

  private vendorManagementSelect() {
    return {
      id: true,
      userId: true,
      marketId: true,
      businessName: true,
      businessEmail: true,
      businessPhone: true,
      description: true,
      logoUrl: true,
      websiteUrl: true,
      selectedPlan: true,
      status: true,
      isVerified: true,
      verifiedAt: true,
      reliabilityScore: true,
      approvedAt: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          profile: true,
        },
      },
      market: {
        select: this.marketSelect(),
      },
      verificationRequests: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          status: true,
          documents: true,
          notes: true,
          reviewedAt: true,
          rejectionReason: true,
          createdAt: true,
          reviewedBy: {
            select: { id: true, email: true, profile: true },
          },
        },
      },
      foodTrucks: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          truckType: true,
          currentAddress: true,
          primaryCity: true,
          averageRating: true,
          totalReviews: true,
          totalBookings: true,
          followerCount: true,
          createdAt: true,
          cuisines: { include: { cuisine: true } },
          serviceAreas: {
            select: {
              id: true,
              name: true,
              centerAddress: true,
              radiusKm: true,
            },
          },
          menus: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              categories: {
                select: {
                  id: true,
                  name: true,
                  items: {
                    where: { status: MenuItemStatus.AVAILABLE },
                    select: {
                      id: true,
                      name: true,
                      price: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      payments: {
        where: { status: PaymentStatus.SUCCEEDED },
        select: { amount: true },
      },
      vendorBadges: {
        where: { revokedAt: null },
        include: { badge: true },
      },
      photoShootRequests: {
        orderBy: { createdAt: 'desc' as const },
        take: 3,
      },
    };
  }

  private toVendorManagementRow(vendor: any) {
    const trucks = vendor.foodTrucks ?? [];
    const primaryTruck = trucks[0] ?? null;
    const cuisines = this.vendorCuisines(trucks);
    const menuItems = this.vendorMenuItems(trucks);
    const prices = menuItems.map((item) => Number(item.price ?? 0));
    const totalRevenue = (vendor.payments ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const totalReviews = trucks.reduce(
      (sum, truck) => sum + (truck.totalReviews ?? 0),
      0,
    );
    const totalFollowers = trucks.reduce(
      (sum, truck) => sum + (truck.followerCount ?? 0),
      0,
    );
    const totalBookings = trucks.reduce(
      (sum, truck) => sum + (truck.totalBookings ?? 0),
      0,
    );

    return {
      id: vendor.id,
      businessName: vendor.businessName,
      status: vendor.status,
      isVerified: vendor.isVerified,
      ownerName: this.userDisplayName(vendor.user),
      email: vendor.businessEmail ?? vendor.user?.email ?? null,
      phone: vendor.businessPhone ?? vendor.user?.phone ?? null,
      cuisine: cuisines[0] ?? null,
      cuisines,
      rating: Number(primaryTruck?.averageRating ?? 0),
      reviews: totalReviews,
      followers: totalFollowers,
      totalBookings,
      revenueGenerated: totalRevenue,
      description: vendor.description ?? primaryTruck?.description ?? null,
      serviceArea:
        primaryTruck?.serviceAreas?.map((area) => area.name).join(', ') ??
        primaryTruck?.currentAddress ??
        null,
      menuItems: menuItems.slice(0, 12).map((item) => item.name),
      priceRange: this.priceRange(prices),
      memberSince: vendor.createdAt,
      primaryTruck,
      foodTrucks: trucks,
      verificationRequests: vendor.verificationRequests ?? [],
      documents: vendor.verificationRequests?.[0]?.documents ?? [],
      badges: vendor.vendorBadges ?? [],
      photoShootRequests: vendor.photoShootRequests ?? [],
    };
  }

  private vendorCuisines(foodTrucks: any[]) {
    return Array.from(
      new Set(
        foodTrucks.flatMap((truck) =>
          (truck.cuisines ?? [])
            .map((item) => item.cuisine?.name)
            .filter(Boolean),
        ),
      ),
    );
  }

  private vendorMenuItems(foodTrucks: any[]) {
    return foodTrucks.flatMap((truck) =>
      (truck.menus ?? []).flatMap((menu) =>
        (menu.categories ?? []).flatMap((category) => category.items ?? []),
      ),
    );
  }

  private priceRange(prices: number[]) {
    const validPrices = prices.filter((price) => Number.isFinite(price));

    if (!validPrices.length) {
      return null;
    }

    const min = Math.min(...validPrices);
    const max = Math.max(...validPrices);

    return min === max
      ? `$${min.toFixed(2)}`
      : `$${min.toFixed(2)}-$${max.toFixed(2)}`;
  }

  private matchesDocumentKey(document: unknown, documentKey: string) {
    if (!document || typeof document !== 'object') {
      return false;
    }

    const candidate = document as Record<string, unknown>;
    const normalizedKey = documentKey.trim().toLowerCase();

    return ['id', 'type', 'name', 'label'].some((field) => {
      const value = candidate[field];
      return (
        typeof value === 'string' &&
        value.trim().toLowerCase() === normalizedKey
      );
    });
  }

  private bookingSelect() {
    return {
      id: true,
      bookingNumber: true,
      customerId: true,
      vendorId: true,
      foodTruckId: true,
      bookingType: true,
      eventType: true,
      status: true,
      eventName: true,
      startsAt: true,
      endsAt: true,
      guestCount: true,
      address: true,
      subtotal: true,
      serviceFee: true,
      taxAmount: true,
      discountAmount: true,
      totalAmount: true,
      createdAt: true,
      customer: {
        select: { id: true, email: true, phone: true, profile: true },
      },
      vendor: {
        select: {
          id: true,
          businessName: true,
          businessEmail: true,
          businessPhone: true,
        },
      },
      foodTruck: { select: { id: true, name: true, slug: true } },
    };
  }

  private bookingManagementSelect() {
    return {
      ...this.bookingSelect(),
      paymentPreference: true,
      quotes: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          pricingModel: true,
          paymentPreference: true,
          depositAmount: true,
          depositPercent: true,
          balanceDueAtEvent: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
          commission: true,
          refunds: true,
        },
      },
      review: {
        select: {
          id: true,
          status: true,
          reports: {
            where: {
              status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
            },
            select: {
              id: true,
              reason: true,
              status: true,
              createdAt: true,
            },
          },
        },
      },
    };
  }

  private toBookingManagementRow(booking: any) {
    const quote = booking.quotes?.[0] ?? null;
    const payment = booking.payments?.[0] ?? null;

    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      customer: {
        id: booking.customerId,
        name: this.userDisplayName(booking.customer),
        email: booking.customer?.email ?? null,
        phone: booking.customer?.phone ?? null,
      },
      vendor: {
        id: booking.vendorId,
        businessName: booking.vendor?.businessName ?? null,
        email: booking.vendor?.businessEmail ?? null,
        phone: booking.vendor?.businessPhone ?? null,
      },
      foodTruck: booking.foodTruck,
      event: {
        name: booking.eventName,
        type: booking.eventType,
        bookingType: booking.bookingType,
        startsAt: booking.startsAt,
        endsAt: booking.endsAt,
        guestCount: booking.guestCount,
        address: booking.address,
      },
      amount: Number(booking.totalAmount ?? 0),
      fees: {
        subtotal: Number(booking.subtotal ?? 0),
        serviceFee: Number(booking.serviceFee ?? 0),
        taxAmount: Number(booking.taxAmount ?? 0),
        discountAmount: Number(booking.discountAmount ?? 0),
      },
      paymentModel: quote?.paymentPreference ?? booking.paymentPreference,
      pricingModel: quote?.pricingModel ?? null,
      status: booking.status,
      payment: payment
        ? {
            id: payment.id,
            amount: Number(payment.amount ?? 0),
            currency: payment.currency,
            status: payment.status,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt,
            commission: payment.commission
              ? {
                  ...payment.commission,
                  grossAmount: Number(payment.commission.grossAmount ?? 0),
                  commissionRate: Number(
                    payment.commission.commissionRate ?? 0,
                  ),
                  commissionAmount: Number(
                    payment.commission.commissionAmount ?? 0,
                  ),
                  vendorNetAmount: Number(
                    payment.commission.vendorNetAmount ?? 0,
                  ),
                }
              : null,
            refunds: (payment.refunds ?? []).map((refund) => ({
              ...refund,
              amount: Number(refund.amount ?? 0),
            })),
          }
        : null,
      dispute: {
        isDisputed: Boolean(booking.review?.reports?.length),
        reports: booking.review?.reports ?? [],
        source: 'review_reports',
      },
      createdAt: booking.createdAt,
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
        averageRating:
          Math.round(Number(reviewsAgg._avg?.rating ?? 0) * 100) / 100,
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
    const averageValue =
      Math.round(Number(totalBookingAmount._avg.totalAmount ?? 0) * 100) / 100;

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
      averageCommissionRate:
        Math.round(Number(commissionsAgg._avg.commissionRate ?? 0) * 10000) /
        10000,
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
      averageVendorReliability:
        Math.round(
          Number(vendorReliabilityAgg._avg.reliabilityScore ?? 0) * 100,
        ) / 100,
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
