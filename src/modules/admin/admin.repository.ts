import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  CommunityPostCategory,
  CommunityPostReportStatus,
  LoyaltyTransactionType,
  MenuItemStatus,
  PaymentStatus,
  PayoutStatus,
  ReportStatus,
  ReviewStatus,
  UserRole,
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

type UserManagementProfile = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
} | null;

type UserManagementRowData = {
  id: string;
  email: string | null;
  phone: string | null;
  status: AccountStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile: UserManagementProfile;
  loyaltyAccount: {
    availablePoints: number;
    lifetimePoints: number;
    redeemedPoints: number;
  } | null;
  userRoles: Array<{ role: UserRole }>;
  _count: {
    customerBookings: number;
    referralsMade: number;
  };
};

type CommunityAuthor = {
  id: string;
  email: string | null;
  phone?: string | null;
  profile: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
  } | null;
};

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

  async getUsersManagement(query: AdminListQueryDto) {
    const now = new Date();
    const currentMonthStart = this.startOfMonth(now);
    const weekStart = this.startOfWeek(now);
    const where = this.userWhere(query);

    const [totalUsers, activeThisMonth, newThisWeek, suspended, users] =
      await Promise.all([
        this.prisma.user.count({ where: { deletedAt: null } }),
        this.prisma.user.count({
          where: {
            deletedAt: null,
            status: AccountStatus.ACTIVE,
            OR: [
              { lastLoginAt: { gte: currentMonthStart } },
              { createdAt: { gte: currentMonthStart } },
            ],
          },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, createdAt: { gte: weekStart } },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, status: AccountStatus.SUSPENDED },
        }),
        this.prisma.user.findMany({
          where,
          select: this.userManagementSelect(),
          orderBy: this.userOrderBy(query),
          take: this.limit(query),
          skip: query.offset ?? 0,
        }),
      ]);

    return {
      generatedAt: now,
      summary: {
        totalUsers,
        activeThisMonth,
        newThisWeek,
        suspended,
      },
      users: users.map((user) => this.toUserManagementRow(user)),
    };
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

  async getPaymentsManagement(query: AdminListQueryDto) {
    const now = new Date();
    const currentMonthStart = this.startOfMonth(now);
    const nextMonthStart = this.addMonths(currentMonthStart, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      pendingPayouts,
      totalPayments,
      monthlyRevenue,
      commissionEarned,
      payoutRequests,
      payments,
      payouts,
      refunds,
      paymentAccounts,
      yearlyPayments,
      yearlyCommissions,
      yearlyPayouts,
    ] = await Promise.all([
      this.prisma.payout.count({ where: { status: PayoutStatus.PENDING } }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: { gte: currentMonthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
      this.prisma.commission.aggregate({
        _sum: { commissionAmount: true },
      }),
      this.prisma.payout.findMany({
        where: query.status
          ? { status: query.status as PayoutStatus }
          : undefined,
        include: this.payoutInclude(),
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        take: this.limit(query),
        skip: query.offset ?? 0,
      }),
      this.prisma.payment.findMany({
        include: this.paymentTransactionInclude(),
        orderBy: { createdAt: 'desc' },
        take: this.limit(query),
      }),
      this.prisma.payout.findMany({
        include: this.payoutTransactionInclude(),
        orderBy: { createdAt: 'desc' },
        take: this.limit(query),
      }),
      this.prisma.refund.findMany({
        include: {
          payment: {
            include: {
              vendor: { select: { id: true, businessName: true } },
              commission: true,
            },
          },
        },
        orderBy: { processedAt: 'desc' },
        take: this.limit(query),
      }),
      this.prisma.vendorPaymentAccount.findMany({
        include: {
          vendor: {
            select: {
              id: true,
              businessName: true,
              businessEmail: true,
              payouts: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: { gte: yearStart },
        },
        select: { amount: true, paidAt: true, createdAt: true },
      }),
      this.prisma.commission.findMany({
        where: { createdAt: { gte: yearStart } },
        select: { commissionAmount: true, createdAt: true },
      }),
      this.prisma.payout.findMany({
        where: { createdAt: { gte: yearStart } },
        select: { amount: true, status: true, paidAt: true, createdAt: true },
      }),
    ]);

    const revenueOverview = this.toRevenueOverview(
      now,
      yearlyPayments,
      yearlyCommissions,
      yearlyPayouts,
    );
    const transactions = [
      ...payments.map((payment) => this.toPaymentTransaction(payment)),
      ...payouts.map((payout) => this.toPayoutTransaction(payout)),
      ...refunds.map((refund) => this.toRefundTransaction(refund)),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, this.limit(query));

    return {
      generatedAt: now,
      summary: {
        pendingPayouts,
        totalAmount: Number(totalPayments._sum.amount ?? 0),
        revenueThisMonth: Number(monthlyRevenue._sum.amount ?? 0),
        commissionEarned: Number(commissionEarned._sum.commissionAmount ?? 0),
      },
      tabs: {
        payoutRequests: payoutRequests.length,
        revenueOverview: true,
        transactionHistory: transactions.length,
        paymentMethods: paymentAccounts.length,
      },
      payoutRequests: payoutRequests.map((payout) =>
        this.toPayoutRequestRow(payout),
      ),
      revenueOverview,
      transactions,
      paymentMethods: {
        summary: {
          bankTransfers: 0,
          paypalAccounts: 0,
          stripeConnected: paymentAccounts.filter(
            (account) => account.stripeAccountId,
          ).length,
        },
        methods: paymentAccounts.map((account) =>
          this.toPaymentMethodRow(account),
        ),
      },
      schemaGaps: {
        bankAccounts:
          'Vendor bank transfer account details are not stored separately; only Stripe Connect account metadata exists.',
        paypalAccounts:
          'PayPal payout account details are not present in the current schema.',
        taxInfo:
          'W-9, tax ID type, YTD tax threshold, and 1099-K flags are not present in the current schema.',
      },
    };
  }

  updatePayoutStatus(
    payoutId: string,
    status: 'PAID' | 'CANCELLED' | 'PROCESSING',
    failureReason?: string,
  ) {
    return this.prisma.payout.update({
      where: { id: payoutId },
      data: {
        status,
        ...(status === 'PAID' ? { paidAt: new Date() } : {}),
        ...(failureReason !== undefined ? { failureReason } : {}),
      },
      include: this.payoutInclude(),
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
      where: this.reviewWhere(query),
      select: this.reviewManagementSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  async getReviewsManagement(query: AdminListQueryDto) {
    const now = new Date();
    const weekStart = this.startOfWeek(now);
    const where = this.reviewWhere(query);

    const [totalReviews, averageRating, reported, removedThisWeek, reviews] =
      await Promise.all([
        this.prisma.review.count(),
        this.prisma.review.aggregate({
          where: { status: { not: ReviewStatus.REMOVED }, ratingVisible: true },
          _avg: { rating: true },
        }),
        this.prisma.reviewReport.count({
          where: {
            status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
          },
        }),
        this.prisma.review.count({
          where: {
            status: ReviewStatus.REMOVED,
            moderatedAt: { gte: weekStart },
          },
        }),
        this.prisma.review.findMany({
          where,
          select: this.reviewManagementSelect(),
          orderBy: { createdAt: query.sortOrder ?? 'desc' },
          take: this.limit(query),
          skip: query.offset ?? 0,
        }),
      ]);

    return {
      generatedAt: now,
      summary: {
        totalReviews,
        averageRating:
          Math.round(Number(averageRating._avg.rating ?? 0) * 10) / 10,
        reported,
        removedThisWeek,
      },
      tabs: {
        allReviews: totalReviews,
        reportedOnly: reported,
        bookings: totalReviews,
        checkIn: 0,
      },
      reviews: reviews.map((review) => this.toReviewManagementRow(review)),
    };
  }

  resolveReviewReportsForReview(
    reviewId: string,
    adminUserId: string,
    status: 'RESOLVED' | 'DISMISSED',
    resolutionNotes: string,
  ) {
    return this.prisma.reviewReport.updateMany({
      where: {
        reviewId,
        status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
      },
      data: {
        status,
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        resolutionNotes,
      },
    });
  }

  listCommunityRequests(query: AdminListQueryDto) {
    return this.prisma.communityRequest.findMany({
      where: this.communityWhere(query),
      select: this.communityRequestSelect(),
      orderBy: { createdAt: query.sortOrder ?? 'desc' },
      take: this.limit(query),
      skip: query.offset ?? 0,
    });
  }

  async getCommunityManagement(query: AdminListQueryDto) {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const tomorrowStart = this.addDays(todayStart, 1);
    const where = this.communityWhere(query);

    const [totalPosts, today, reported, removedToday, postsByCategory, posts] =
      await Promise.all([
        this.prisma.communityRequest.count({ where: { deletedAt: null } }),
        this.prisma.communityRequest.count({
          where: {
            deletedAt: null,
            createdAt: { gte: todayStart, lt: tomorrowStart },
          },
        }),
        this.prisma.communityPostReport.count({
          where: {
            status: {
              in: [
                CommunityPostReportStatus.PENDING,
                CommunityPostReportStatus.REVIEWING,
              ],
            },
          },
        }),
        this.prisma.communityRequest.count({
          where: {
            deletedAt: { gte: todayStart, lt: tomorrowStart },
          },
        }),
        this.prisma.communityRequest.groupBy({
          by: ['category'],
          where: { deletedAt: null },
          _count: { id: true },
        }),
        this.prisma.communityRequest.findMany({
          where,
          select: this.communityRequestSelect(),
          orderBy: { createdAt: query.sortOrder ?? 'desc' },
          take: this.limit(query),
          skip: query.offset ?? 0,
        }),
      ]);

    return {
      generatedAt: now,
      summary: {
        totalPosts,
        today,
        reported,
        removedToday,
      },
      tabs: {
        allPosts: totalPosts,
        ...Object.fromEntries(
          postsByCategory.map((item) => [
            this.communityCategoryKey(item.category),
            item._count.id,
          ]),
        ),
      },
      posts: posts.map((post) => this.toCommunityManagementRow(post)),
    };
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

  async removeCommunityRequest(requestId: string, adminUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.communityRequest.update({
        where: { id: requestId },
        data: { deletedAt: new Date() },
        select: this.communityRequestSelect(),
      });

      await tx.communityPostReport.updateMany({
        where: {
          postId: requestId,
          status: {
            in: [
              CommunityPostReportStatus.PENDING,
              CommunityPostReportStatus.REVIEWING,
            ],
          },
        },
        data: {
          status: CommunityPostReportStatus.RESOLVED,
          reviewedById: adminUserId,
          reviewedAt: new Date(),
          resolutionNotes: 'Post removed by admin',
        },
      });

      return removed;
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

  async getRewardsManagement(query: AdminListQueryDto) {
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const tomorrowStart = this.addDays(todayStart, 1);
    const limit = this.limit(query);

    const [
      redeemedPoints,
      redeemedCredits,
      activeUsers,
      qrScansToday,
      loyaltyAccounts,
      redemptions,
      activeLeaderboard,
      fallbackVendors,
      paymentSummary,
    ] = await Promise.all([
      this.prisma.loyaltyTransaction.aggregate({
        where: { transactionType: LoyaltyTransactionType.REDEEM },
        _sum: { points: true },
      }),
      this.prisma.rewardRedemption.aggregate({
        _sum: { rewardValue: true },
      }),
      this.prisma.loyaltyAccount.count({
        where: {
          OR: [
            { availablePoints: { gt: 0 } },
            { lifetimePoints: { gt: 0 } },
            { redeemedPoints: { gt: 0 } },
          ],
        },
      }),
      this.prisma.qrScan.count({
        where: { scannedAt: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.loyaltyAccount.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                },
              },
              userBadges: {
                where: { revokedAt: null },
                include: { badge: true },
              },
            },
          },
          _count: { select: { transactions: true } },
        },
        orderBy: [{ lifetimePoints: 'desc' }, { availablePoints: 'desc' }],
        take: limit,
      }),
      this.prisma.rewardRedemption.findMany({
        include: {
          rewardRule: true,
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                },
              },
              loyaltyAccount: true,
              userBadges: {
                where: { revokedAt: null },
                include: { badge: true },
              },
            },
          },
        },
        orderBy: { redeemedAt: query.sortOrder ?? 'desc' },
        take: limit,
        skip: query.offset ?? 0,
      }),
      this.prisma.leaderboard.findFirst({
        where: { isActive: true },
        include: {
          entries: {
            orderBy: { rank: 'asc' },
            take: limit,
            include: {
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  user: {
                    select: {
                      email: true,
                      profile: {
                        select: {
                          displayName: true,
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                  payments: {
                    where: { status: PaymentStatus.SUCCEEDED },
                    select: { amount: true },
                  },
                },
              },
              foodTruck: {
                select: {
                  id: true,
                  name: true,
                  primaryCity: true,
                  totalBookings: true,
                  totalReviews: true,
                  totalCheckIns: true,
                  followerCount: true,
                },
              },
            },
          },
        },
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.vendor.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          businessName: true,
          user: {
            select: {
              email: true,
              profile: {
                select: {
                  displayName: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          payments: {
            where: { status: PaymentStatus.SUCCEEDED },
            select: { amount: true },
          },
          foodTrucks: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              primaryCity: true,
              totalBookings: true,
              totalReviews: true,
              totalCheckIns: true,
              followerCount: true,
            },
          },
        },
        take: limit,
      }),
      this.rewardsPaymentSummary(now),
    ]);

    const foodTruckIds = redemptions
      .map((redemption) => redemption.foodTruckId)
      .filter((id): id is string => Boolean(id));
    const vendorIds = redemptions
      .map((redemption) => redemption.vendorId)
      .filter((id): id is string => Boolean(id));

    const [redemptionFoodTrucks, redemptionVendors] = await Promise.all([
      foodTruckIds.length
        ? this.prisma.foodTruck.findMany({
            where: { id: { in: foodTruckIds } },
            select: {
              id: true,
              name: true,
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  user: {
                    select: {
                      email: true,
                      profile: {
                        select: {
                          displayName: true,
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
      vendorIds.length
        ? this.prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
            select: {
              id: true,
              businessName: true,
              user: {
                select: {
                  email: true,
                  profile: {
                    select: {
                      displayName: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const foodTruckById = new Map<string, any>(
      redemptionFoodTrucks.map((truck) => [truck.id, truck] as [string, any]),
    );
    const vendorById = new Map<string, any>(
      redemptionVendors.map((vendor) => [vendor.id, vendor] as [string, any]),
    );
    const topUsers = loyaltyAccounts.map((account, index) =>
      this.toRewardTopUser(account, index + 1),
    );

    return {
      generatedAt: now,
      summary: {
        pointsRedeemed: Math.abs(redeemedPoints._sum.points ?? 0),
        creditsIssued: Number(redeemedCredits._sum.rewardValue ?? 0),
        activeUsers,
        qrScansToday,
      },
      paymentSummary,
      tabs: {
        leaderboard: activeLeaderboard?.entries.length ?? fallbackVendors.length,
        redeemTransactions: redemptions.length,
        topUsers: topUsers.length,
      },
      tierCounts: this.rewardTierCounts(
        loyaltyAccounts.map((account) => account.lifetimePoints),
      ),
      leaderboard: this.toRewardLeaderboardRows(
        activeLeaderboard?.entries ?? [],
        fallbackVendors,
      ),
      redeemTransactions: redemptions.map((redemption) =>
        this.toRewardRedemptionRow(redemption, foodTruckById, vendorById),
      ),
      topUsers,
      schemaGaps: {
        rewardCredits: 'Stored on reward_redemptions.reward_value.',
        userTier:
          'Derived from loyalty_accounts.lifetime_points using rewards tier thresholds.',
        qrScansToday: 'Stored on qr_scans.scanned_at.',
      },
    };
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

  private startOfWeek(date: Date) {
    const start = new Date(date);
    const day = start.getDay();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - day);
    return start;
  }

  private startOfDay(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private startOfYear(date: Date) {
    return new Date(date.getFullYear(), 0, 1);
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

  private userWhere(query: AdminListQueryDto) {
    return {
      deletedAt: null,
      ...(query.status ? { status: query.status as AccountStatus } : {}),
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
              {
                profile: {
                  firstName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                profile: {
                  lastName: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                profile: {
                  city: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                profile: {
                  state: {
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

  private userOrderBy(query: AdminListQueryDto) {
    if (query.sortBy === 'updatedAt') {
      return { updatedAt: query.sortOrder ?? 'desc' };
    }

    if (query.sortBy === 'status') {
      return { status: query.sortOrder ?? 'asc' };
    }

    return { createdAt: query.sortOrder ?? 'desc' };
  }

  private userManagementSelect() {
    return {
      id: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      profile: true,
      loyaltyAccount: {
        select: {
          availablePoints: true,
          lifetimePoints: true,
          redeemedPoints: true,
        },
      },
      userRoles: {
        select: { role: true },
      },
      _count: {
        select: {
          customerBookings: true,
          referralsMade: true,
        },
      },
    };
  }

  private toUserManagementRow(user: UserManagementRowData) {
    const totalBookings = user._count?.customerBookings ?? 0;
    const referrals = user._count?.referralsMade ?? 0;
    const loyaltyPoints = user.loyaltyAccount?.availablePoints ?? 0;
    const name = this.userDisplayName(user);

    return {
      id: user.id,
      userId: this.shortDisplayId('U', user.id),
      name,
      initials: this.initials(name),
      email: user.email,
      phone: user.phone,
      location: this.userLocation(user.profile),
      joinDate: user.createdAt,
      memberSince: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      activity: {
        totalBookings,
        referrals,
      },
      totalBookings,
      referrals,
      loyaltyPoints,
      lifetimePoints: user.loyaltyAccount?.lifetimePoints ?? 0,
      redeemedPoints: user.loyaltyAccount?.redeemedPoints ?? 0,
      status: user.status,
      roles: (user.userRoles ?? []).map((userRole) => userRole.role),
      profile: user.profile,
      canSuspend: user.status !== AccountStatus.SUSPENDED,
      canRetrieve: user.status === AccountStatus.SUSPENDED,
      contact: {
        name,
        email: user.email,
        phone: user.phone,
        location: this.userLocation(user.profile),
      },
    };
  }

  private userLocation(profile: UserManagementProfile) {
    const parts = [profile?.city, profile?.state].filter(Boolean);

    if (parts.length) {
      return parts.join(', ');
    }

    return profile?.country ?? null;
  }

  private shortDisplayId(prefix: string, id: string) {
    return `${prefix}-${id.replace(/-/g, '').slice(-4).toUpperCase()}`;
  }

  private initials(name: string) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private communityWhere(query: AdminListQueryDto) {
    const category = this.toCommunityCategory(query.category);

    return {
      ...(query.status ? { status: query.status as any } : {}),
      ...(category ? { category } : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                createdBy: {
                  email: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                createdBy: {
                  profile: {
                    displayName: {
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

  private toCommunityCategory(
    category?: string,
  ): CommunityPostCategory | undefined {
    if (!category) {
      return undefined;
    }

    const normalizedCategory = category.trim().toUpperCase();

    if (
      Object.values(CommunityPostCategory).includes(
        normalizedCategory as CommunityPostCategory,
      )
    ) {
      return normalizedCategory as CommunityPostCategory;
    }

    return undefined;
  }

  private communityCategoryKey(category: CommunityPostCategory) {
    return category
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }

  private toCommunityManagementRow(post: any) {
    const author = post.createdBy as CommunityAuthor;
    const authorName = this.userDisplayName(author);
    const activeReports = (post.reports ?? []).filter((report) =>
      [
        CommunityPostReportStatus.PENDING,
        CommunityPostReportStatus.REVIEWING,
      ].includes(report.status),
    );
    const primaryReport = activeReports[0] ?? post.reports?.[0] ?? null;
    const comments = post.comments ?? [];
    const reactions = post.reactions ?? [];

    return {
      id: post.id,
      postId: this.shortDisplayId('P', post.id),
      title: post.title,
      content: post.description ?? post.title,
      category: post.category,
      type: post.requestType,
      status: post.status,
      visibility: post.visibility,
      author: {
        id: author.id,
        userId: this.shortDisplayId('U', author.id),
        name: authorName,
        initials: this.initials(authorName),
        email: author.email,
        phone: author.phone ?? null,
        avatarUrl: author.profile?.avatarUrl ?? null,
      },
      postedAt: post.createdAt,
      createdAt: post.createdAt,
      deletedAt: post.deletedAt,
      likes: reactions.length,
      commentsCount: comments.length,
      media: post.media ?? [],
      imageUrls: (post.media ?? [])
        .filter((media) => media.mediaType?.toLowerCase().startsWith('image'))
        .map((media) => media.mediaUrl),
      isReported: activeReports.length > 0,
      reportReason: primaryReport?.reason ?? null,
      reportStatus: primaryReport?.status ?? null,
      reports: post.reports ?? [],
      comments: comments.map((comment) => {
        const commenter = comment.user as CommunityAuthor;
        const commenterName = this.userDisplayName(commenter);

        return {
          id: comment.id,
          content: comment.content,
          createdAt: comment.createdAt,
          deletedAt: comment.deletedAt,
          author: {
            id: commenter.id,
            name: commenterName,
            initials: this.initials(commenterName),
            email: commenter.email,
            avatarUrl: commenter.profile?.avatarUrl ?? null,
          },
          likes: 0,
        };
      }),
      moderation: {
        canRemove: !post.deletedAt,
        canContactAuthor: Boolean(author.email || author.phone),
      },
    };
  }

  private reviewWhere(query: AdminListQueryDto) {
    const reportedOnly =
      query.status?.trim().toUpperCase() === 'REPORTED' ||
      query.category?.trim().toUpperCase() === 'REPORTED';
    const source = query.category?.trim().toUpperCase();
    const status = this.toReviewStatus(query.status);

    return {
      ...(status ? { status } : {}),
      ...(reportedOnly
        ? {
            reports: {
              some: {
                status: { in: [ReportStatus.PENDING, ReportStatus.REVIEWING] },
              },
            },
          }
        : {}),
      ...(source === 'CHECK_IN' ? { id: '__no_check_in_review_source__' } : {}),
      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                content: {
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
                foodTruck: {
                  name: {
                    contains: query.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
              {
                booking: {
                  bookingNumber: {
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

  private toReviewStatus(status?: string): ReviewStatus | undefined {
    if (!status) {
      return undefined;
    }

    const normalizedStatus = status.trim().toUpperCase();

    if (
      Object.values(ReviewStatus).includes(normalizedStatus as ReviewStatus)
    ) {
      return normalizedStatus as ReviewStatus;
    }

    return undefined;
  }

  private reviewManagementSelect() {
    return {
      id: true,
      bookingId: true,
      customerId: true,
      vendorId: true,
      foodTruckId: true,
      rating: true,
      title: true,
      content: true,
      isVerified: true,
      status: true,
      contentHidden: true,
      ratingVisible: true,
      moderatedAt: true,
      moderationReason: true,
      createdAt: true,
      booking: {
        select: {
          id: true,
          bookingNumber: true,
          bookingType: true,
          status: true,
          completedAt: true,
        },
      },
      customer: {
        select: { id: true, email: true, phone: true, profile: true },
      },
      vendor: {
        select: { id: true, businessName: true, businessEmail: true },
      },
      foodTruck: {
        select: { id: true, name: true, slug: true },
      },
      reports: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          reportedBy: { select: { id: true, email: true, profile: true } },
          reviewedBy: { select: { id: true, email: true, profile: true } },
        },
      },
    };
  }

  private toReviewManagementRow(review: any) {
    const customer = review.customer as CommunityAuthor;
    const customerName = this.userDisplayName(customer);
    const activeReports = (review.reports ?? []).filter((report) =>
      [ReportStatus.PENDING, ReportStatus.REVIEWING].includes(report.status),
    );
    const primaryReport = activeReports[0] ?? review.reports?.[0] ?? null;

    return {
      id: review.id,
      reviewId: this.shortDisplayId('R', review.id),
      rating: review.rating,
      title: review.title,
      content: review.content,
      visibleContent: review.contentHidden ? null : review.content,
      isVerified: review.isVerified,
      status: review.status,
      contentHidden: review.contentHidden,
      ratingVisible: review.ratingVisible,
      source: 'BOOKING',
      sourceLabel: 'Booking',
      customer: {
        id: customer.id,
        name: customerName,
        initials: this.initials(customerName),
        email: customer.email,
        phone: customer.phone ?? null,
        avatarUrl: customer.profile?.avatarUrl ?? null,
      },
      vendor: review.vendor,
      foodTruck: review.foodTruck,
      booking: review.booking,
      isReported: activeReports.length > 0,
      reportReason: primaryReport?.reason ?? null,
      reportDescription: primaryReport?.description ?? null,
      reportStatus: primaryReport?.status ?? null,
      reports: review.reports ?? [],
      moderationReason: review.moderationReason,
      createdAt: review.createdAt,
      moderatedAt: review.moderatedAt,
      actions: {
        canRemoveCompletely: review.status !== ReviewStatus.REMOVED,
        canHideTextOnly: !review.contentHidden,
        canKeepReview: activeReports.length > 0,
      },
    };
  }

  private payoutInclude() {
    return {
      vendor: {
        select: {
          id: true,
          businessName: true,
          businessEmail: true,
          businessPhone: true,
          user: {
            select: { id: true, email: true, phone: true, profile: true },
          },
          paymentAccount: true,
          bookings: {
            where: { status: 'COMPLETED' as any },
            select: { id: true },
          },
          commissions: {
            select: { vendorNetAmount: true, commissionAmount: true },
          },
        },
      },
    };
  }

  private paymentTransactionInclude() {
    return {
      vendor: { select: { id: true, businessName: true } },
      booking: { select: { id: true, bookingNumber: true, status: true } },
      commission: true,
    };
  }

  private payoutTransactionInclude() {
    return {
      vendor: { select: { id: true, businessName: true } },
    };
  }

  private toPayoutRequestRow(payout: any) {
    const paymentAccount = payout.vendor?.paymentAccount;
    const ytdEarnings = (payout.vendor?.commissions ?? []).reduce(
      (sum, commission) => sum + Number(commission.vendorNetAmount ?? 0),
      0,
    );

    return {
      id: payout.id,
      payoutId: this.shortDisplayId('PO', payout.id),
      vendorId: payout.vendorId,
      vendorName: payout.vendor?.businessName ?? null,
      ownerName: this.userDisplayName(payout.vendor?.user),
      ownerEmail:
        payout.vendor?.businessEmail ?? payout.vendor?.user?.email ?? null,
      amount: Number(payout.amount ?? 0),
      currency: payout.currency,
      completedBookings: payout.vendor?.bookings?.length ?? 0,
      payoutMethod: this.payoutMethod(paymentAccount),
      requestedAt: payout.createdAt,
      status: this.payoutDisplayStatus(payout.status),
      failureReason: payout.failureReason,
      paidAt: payout.paidAt,
      taxInfo: {
        w9Submitted: null,
        taxIdType: null,
        ytdEarnings,
        threshold1099K: 600,
        requires1099K: ytdEarnings >= 600,
      },
      actions: {
        canApprove: payout.status === PayoutStatus.PENDING,
        canReject: payout.status === PayoutStatus.PENDING,
        canHold: payout.status === PayoutStatus.PENDING,
      },
    };
  }

  private payoutMethod(paymentAccount: any) {
    if (paymentAccount?.stripeAccountId) {
      return {
        type: 'STRIPE_CONNECT',
        label: 'Stripe Connected',
        accountId: paymentAccount.stripeAccountId,
        onboardingCompleted: paymentAccount.onboardingCompleted,
        chargesEnabled: paymentAccount.chargesEnabled,
        payoutsEnabled: paymentAccount.payoutsEnabled,
        disabledReason: paymentAccount.disabledReason,
      };
    }

    return {
      type: 'UNKNOWN',
      label: 'Not configured',
    };
  }

  private payoutDisplayStatus(status: PayoutStatus) {
    if (status === PayoutStatus.PAID) {
      return 'APPROVED';
    }

    if (status === PayoutStatus.PROCESSING) {
      return 'ON_HOLD';
    }

    return status;
  }

  private toPaymentTransaction(payment: any) {
    return {
      id: payment.id,
      transactionId: this.shortDisplayId('TXN', payment.id),
      type: 'BOOKING',
      vendorId: payment.vendorId,
      vendorName: payment.vendor?.businessName ?? null,
      amount: Number(payment.amount ?? 0),
      commission: Number(payment.commission?.commissionAmount ?? 0),
      method: payment.stripePaymentIntentId ? 'Stripe' : 'Unknown',
      date: payment.paidAt ?? payment.createdAt,
      status: payment.status,
      booking: payment.booking,
    };
  }

  private toPayoutTransaction(payout: any) {
    return {
      id: payout.id,
      transactionId: this.shortDisplayId('TXN', payout.id),
      type: 'PAYOUT',
      vendorId: payout.vendorId,
      vendorName: payout.vendor?.businessName ?? null,
      amount: Number(payout.amount ?? 0),
      commission: 0,
      method: payout.stripeTransferId ? 'Stripe Transfer' : 'Stripe Connect',
      date: payout.paidAt ?? payout.createdAt,
      status: this.payoutDisplayStatus(payout.status),
      booking: null,
    };
  }

  private toRefundTransaction(refund: any) {
    return {
      id: refund.id,
      transactionId: this.shortDisplayId('TXN', refund.id),
      type: 'REFUND',
      vendorId: refund.payment?.vendorId ?? null,
      vendorName: refund.payment?.vendor?.businessName ?? null,
      amount: -Number(refund.amount ?? 0),
      commission: -Number(refund.payment?.commission?.commissionAmount ?? 0),
      method: refund.stripeRefundId ? 'Stripe' : 'Unknown',
      date: refund.processedAt ?? new Date(0),
      status: refund.status,
      booking: null,
    };
  }

  private async rewardsPaymentSummary(now: Date) {
    const currentMonthStart = this.startOfMonth(now);
    const nextMonthStart = this.addMonths(currentMonthStart, 1);
    const [pendingPayouts, totalPayments, monthlyRevenue, commissionEarned] =
      await Promise.all([
        this.prisma.payout.count({ where: { status: PayoutStatus.PENDING } }),
        this.prisma.payment.aggregate({
          where: { status: PaymentStatus.SUCCEEDED },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.SUCCEEDED,
            paidAt: { gte: currentMonthStart, lt: nextMonthStart },
          },
          _sum: { amount: true },
        }),
        this.prisma.commission.aggregate({
          _sum: { commissionAmount: true },
        }),
      ]);

    return {
      pendingPayouts,
      totalAmount: Number(totalPayments._sum.amount ?? 0),
      revenueThisMonth: Number(monthlyRevenue._sum.amount ?? 0),
      commissionEarned: Number(commissionEarned._sum.commissionAmount ?? 0),
    };
  }

  private toRewardLeaderboardRows(entries: any[], fallbackVendors: any[]) {
    if (entries.length) {
      return entries.map((entry) => {
        const revenue = this.sumAmounts(entry.vendor?.payments ?? []);
        return {
          rank: entry.rank,
          vendorId: entry.vendorId,
          foodTruckId: entry.foodTruckId,
          truckName: entry.foodTruck?.name ?? entry.vendor?.businessName ?? null,
          ownerName: this.userDisplayName(entry.vendor?.user),
          location: entry.foodTruck?.primaryCity ?? null,
          pointsGiven: Math.round(Number(entry.score ?? 0)),
          bookings: entry.foodTruck?.totalBookings ?? 0,
          revenue,
          score: Number(entry.score ?? 0),
          metrics: {
            bookings: entry.foodTruck?.totalBookings ?? 0,
            reviews: entry.foodTruck?.totalReviews ?? 0,
            checkIns: entry.foodTruck?.totalCheckIns ?? 0,
            followers: entry.foodTruck?.followerCount ?? 0,
          },
        };
      });
    }

    return fallbackVendors
      .map((vendor) => {
        const primaryTruck = vendor.foodTrucks[0] ?? null;
        const bookings = vendor.foodTrucks.reduce(
          (sum, truck) => sum + (truck.totalBookings ?? 0),
          0,
        );
        const reviews = vendor.foodTrucks.reduce(
          (sum, truck) => sum + (truck.totalReviews ?? 0),
          0,
        );
        const checkIns = vendor.foodTrucks.reduce(
          (sum, truck) => sum + (truck.totalCheckIns ?? 0),
          0,
        );
        const followers = vendor.foodTrucks.reduce(
          (sum, truck) => sum + (truck.followerCount ?? 0),
          0,
        );
        const revenue = this.sumAmounts(vendor.payments ?? []);
        return {
          vendor,
          primaryTruck,
          bookings,
          reviews,
          checkIns,
          followers,
          revenue,
          pointsGiven: Math.round(bookings * 100 + checkIns * 10 + reviews * 25),
        };
      })
      .sort(
        (a, b) =>
          b.pointsGiven - a.pointsGiven ||
          b.revenue - a.revenue ||
          b.bookings - a.bookings,
      )
      .map((row, index) => ({
        rank: index + 1,
        vendorId: row.vendor.id,
        foodTruckId: row.primaryTruck?.id ?? null,
        truckName: row.primaryTruck?.name ?? row.vendor.businessName,
        ownerName: this.userDisplayName(row.vendor.user),
        location: row.primaryTruck?.primaryCity ?? null,
        pointsGiven: row.pointsGiven,
        bookings: row.bookings,
        revenue: row.revenue,
        score: row.pointsGiven,
        metrics: {
          bookings: row.bookings,
          reviews: row.reviews,
          checkIns: row.checkIns,
          followers: row.followers,
        },
      }));
  }

  private toRewardRedemptionRow(
    redemption: any,
    foodTruckById: Map<string, any>,
    vendorById: Map<string, any>,
  ) {
    const account = redemption.user?.loyaltyAccount;
    const tier = this.loyaltyTier(account?.lifetimePoints ?? 0);
    const truck = redemption.foodTruckId
      ? foodTruckById.get(redemption.foodTruckId)
      : null;
    const vendor = redemption.vendorId
      ? vendorById.get(redemption.vendorId)
      : truck?.vendor;
    const credit = Number(
      redemption.rewardValue ?? redemption.pointsSpent / 100,
    );

    return {
      id: redemption.id,
      transactionId: this.shortDisplayId('RDM', redemption.id),
      user: {
        id: redemption.userId,
        name: this.userDisplayName(redemption.user),
        email: redemption.user?.email ?? null,
        tier,
      },
      truck: truck
        ? { id: truck.id, name: truck.name }
        : redemption.foodTruckId
          ? { id: redemption.foodTruckId, name: null }
          : null,
      truckOwner: vendor
        ? {
            id: vendor.id,
            name: this.userDisplayName(vendor.user),
            businessName: vendor.businessName,
          }
        : null,
      points: -Math.abs(redemption.pointsSpent),
      credit,
      date: redemption.usedAt ?? redemption.redeemedAt,
      status: this.rewardRedemptionStatus(redemption),
      rewardRule: redemption.rewardRule
        ? {
            id: redemption.rewardRule.id,
            name: redemption.rewardRule.name,
            rewardType: redemption.rewardRule.rewardType,
          }
        : null,
      code: redemption.backupCode ?? null,
    };
  }

  private toRewardTopUser(account: any, rank: number) {
    const tier = this.loyaltyTier(account.lifetimePoints ?? 0);
    return {
      rank,
      userId: account.userId,
      name: this.userDisplayName(account.user),
      email: account.user?.email ?? null,
      tier,
      points: account.lifetimePoints ?? 0,
      availablePoints: account.availablePoints ?? 0,
      redeemedPoints: account.redeemedPoints ?? 0,
      transactions: account._count?.transactions ?? 0,
      progressToLegendPercent: Math.min(
        100,
        Math.round(((account.lifetimePoints ?? 0) / 10000) * 100),
      ),
    };
  }

  private rewardTierCounts(points: number[]) {
    return points.reduce(
      (counts, total) => {
        const tier = this.loyaltyTier(total);
        counts[tier.slug] = (counts[tier.slug] ?? 0) + 1;
        return counts;
      },
      {
        bitedrop_legend: 0,
        drop_hunter: 0,
        explorer: 0,
        foodie: 0,
      },
    );
  }

  private loyaltyTier(points: number) {
    if (points >= 10000) {
      return {
        slug: 'bitedrop_legend',
        name: 'BiteDrop Legend',
        level: 4,
        requiredPoints: 10000,
        nextTierPoints: null,
      };
    }

    if (points >= 2000) {
      return {
        slug: 'drop_hunter',
        name: 'Drop Hunter',
        level: 3,
        requiredPoints: 2000,
        nextTierPoints: 10000,
      };
    }

    if (points >= 500) {
      return {
        slug: 'explorer',
        name: 'Explorer',
        level: 2,
        requiredPoints: 500,
        nextTierPoints: 2000,
      };
    }

    return {
      slug: 'foodie',
      name: 'Foodie',
      level: 1,
      requiredPoints: 0,
      nextTierPoints: 500,
    };
  }

  private rewardRedemptionStatus(redemption: any) {
    if (redemption.usedAt) {
      return 'completed';
    }

    return String(redemption.status ?? 'active').toLowerCase();
  }

  private sumAmounts(items: Array<{ amount: unknown }>) {
    return items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  }

  private toPaymentMethodRow(account: any) {
    return {
      id: account.id,
      vendorId: account.vendorId,
      vendorName: account.vendor?.businessName ?? null,
      type: 'STRIPE_CONNECT',
      label: `Stripe · Connected account ${account.stripeAccountId}`,
      isPrimary: true,
      isVerified: account.onboardingCompleted && account.payoutsEnabled,
      onboardingCompleted: account.onboardingCompleted,
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      disabledReason: account.disabledReason,
      updatedAt: account.updatedAt,
    };
  }

  private toRevenueOverview(
    now: Date,
    payments: Array<{ amount: unknown; paidAt: Date | null; createdAt: Date }>,
    commissions: Array<{ commissionAmount: unknown; createdAt: Date }>,
    payouts: Array<{ amount: unknown; status: PayoutStatus; createdAt: Date }>,
  ) {
    const yearStart = this.startOfYear(now);
    const months = Array.from({ length: now.getMonth() + 1 }, (_, index) => {
      const date = new Date(now.getFullYear(), index, 1);
      return {
        month: this.monthLabel(date),
        monthIndex: index,
        revenue: 0,
        commission: 0,
        payouts: 0,
      };
    });

    for (const payment of payments) {
      const date = payment.paidAt ?? payment.createdAt;
      if (date >= yearStart) {
        months[date.getMonth()].revenue += Number(payment.amount ?? 0);
      }
    }

    for (const commission of commissions) {
      months[commission.createdAt.getMonth()].commission += Number(
        commission.commissionAmount ?? 0,
      );
    }

    for (const payout of payouts) {
      if (
        payout.status === PayoutStatus.PAID ||
        payout.status === PayoutStatus.PENDING
      ) {
        months[payout.createdAt.getMonth()].payouts += Number(
          payout.amount ?? 0,
        );
      }
    }

    const totalRevenueYtd = months.reduce((sum, item) => sum + item.revenue, 0);
    const platformCommissionYtd = months.reduce(
      (sum, item) => sum + item.commission,
      0,
    );
    const vendorPayoutsYtd = months.reduce(
      (sum, item) => sum + item.payouts,
      0,
    );

    return {
      summary: {
        totalRevenueYtd,
        platformCommissionYtd,
        vendorPayoutsYtd,
      },
      monthlyRevenueBreakdown: months,
      commissionVsPayouts: months.map((item) => ({
        month: item.month,
        commission: item.commission,
        payouts: item.payouts,
      })),
    };
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
      category: true,
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
      createdBy: {
        select: { id: true, email: true, phone: true, profile: true },
      },
      targetFoodTruck: { select: { id: true, name: true, slug: true } },
      media: true,
      reactions: true,
      reports: {
        orderBy: { createdAt: 'desc' as const },
        include: {
          reportedBy: { select: { id: true, email: true, profile: true } },
          reviewedBy: { select: { id: true, email: true, profile: true } },
        },
      },
      comments: {
        where: { deletedAt: null },
        take: 20,
        orderBy: { createdAt: 'desc' as const },
        include: {
          user: { select: { id: true, email: true, profile: true } },
        },
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
