import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminListQueryDto } from '../admin/dto/admin-list-query.dto';
import { CompleteVendorOnboardingDto } from './dto/complete-vendor-onboarding.dto';
import { UpdatePhotoShootRequestDto } from './dto/update-photo-shoot-request.dto';
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

  findPendingApproval(query: AdminListQueryDto) {
    const search = query.search?.trim();

    return this.prisma.vendor.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        deletedAt: null,
        ...(search
          ? {
              OR: [
                {
                  businessName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  businessEmail: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  user: {
                    OR: [
                      {
                        email: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        phone: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: query.sortOrder ?? 'asc' },
      include: this.vendorInclude(),
      take: this.limit(query),
      skip: query.offset ?? 0,
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

  async completeOnboarding(
    userId: string,
    vendorId: string,
    dto: CompleteVendorOnboardingDto,
    foundingData?: {
      isFoundingMember: boolean;
      foundingJoinedAt: Date | null;
      trialStartedAt: Date | null;
      trialEndsAt: Date | null;
      foundingDiscountEndsAt: Date | null;
      lockedCommissionRate: number | null;
    },
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const selectedPlan = dto.selectedPlan ?? dto.plan ?? 'FREE';
        const rawContactName = dto.contactName ?? dto.contact?.name ?? 'Vendor';
        const [firstName, ...lastNameParts] = rawContactName
          .trim()
          .split(/\s+/);
        const lastName = lastNameParts.join(' ') || undefined;
        const contactCity =
          dto.city ?? dto.contact?.city ?? dto.primaryCity ?? 'Austin';
        const contactState = dto.state ?? dto.contact?.state ?? 'TX';
        const contactEmail = (
          dto.email ??
          dto.contact?.email ??
          ''
        ).toLowerCase();
        const contactPhone = dto.contact?.phoneNumber;
        const logoUrl = dto.logoUrl ?? dto.truckLogoUrl;
        const menuItem = dto.firstMenuItem ??
          dto.menuItem ?? { name: 'Featured Item', price: 10 };
        const menuItemPhotoUrl = menuItem.photoUrl ?? menuItem.imageUrl;
        const radiusKm = dto.serviceRadiusKm ?? dto.serviceRadius ?? 20;
        const latitude = dto.latitude ?? 30.2672;
        const longitude = dto.longitude ?? -97.7431;
        const subscriptionTier = await tx.vendorSubscriptionTier.findFirst({
          where: {
            legacyPlan: selectedPlan as any,
            active: true,
            deletedAt: null,
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        await this.ensureUniqueUserContactInfo(
          tx,
          userId,
          contactEmail || null,
          contactPhone ?? null,
        );

        await tx.user.update({
          where: { id: userId },
          data: {
            ...(contactEmail ? { email: contactEmail } : {}),
            ...(contactPhone ? { phone: contactPhone } : {}),
            updatedAt: new Date(),
            profile: {
              upsert: {
                create: {
                  firstName,
                  lastName,
                  displayName: rawContactName,
                  city: contactCity,
                  state: contactState,
                  country: 'USA',
                },
                update: {
                  firstName,
                  lastName,
                  displayName: rawContactName,
                  city: contactCity,
                  state: contactState,
                  country: 'USA',
                },
              },
            },
          },
        });

        await tx.vendor.update({
          where: { id: vendorId },
          data: {
            selectedPlan,
            activeSubscriptionTierId: subscriptionTier?.id,
            ...(selectedPlan === 'FREE'
              ? { subscriptionStatus: 'ACTIVE' as const }
              : { subscriptionStatus: 'INCOMPLETE' as const }),
            ...(foundingData
              ? {
                  isFoundingMember: foundingData.isFoundingMember,
                  foundingJoinedAt: foundingData.foundingJoinedAt,
                  trialStartedAt: foundingData.trialStartedAt,
                  trialEndsAt: foundingData.trialEndsAt,
                  foundingDiscountEndsAt: foundingData.foundingDiscountEndsAt,
                  lockedCommissionRate: foundingData.lockedCommissionRate,
                }
              : {}),
            businessName: dto.truckName,
            ...(contactEmail ? { businessEmail: contactEmail } : {}),
            ...(contactPhone ? { businessPhone: contactPhone } : {}),
            logoUrl,
            updatedAt: new Date(),
          },
        });

        const existingTruck = await tx.foodTruck.findFirst({
          where: { vendorId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        });
        const slug = await this.createUniqueSlug(
          dto.truckName,
          existingTruck?.id,
        );
        const truckDescription = `${dto.cuisineType} ${dto.truckType
          .toLowerCase()
          .replace(/_/g, ' ')}`;

        const foodTruck = existingTruck
          ? await tx.foodTruck.update({
              where: { id: existingTruck.id },
              data: {
                name: dto.truckName,
                truckCallName: dto.truckCallName,
                truckType: dto.truckType,
                primaryCity: dto.primaryCity,
                slug,
                description: truckDescription,
                profileImageUrl: logoUrl ?? dto.truckImageUrl,
                coverImageUrl: dto.truckImageUrl,
                maximumGuestCapacity: 100,
                updatedAt: new Date(),
              },
            })
          : await tx.foodTruck.create({
              data: {
                vendorId,
                name: dto.truckName,
                truckCallName: dto.truckCallName,
                truckType: dto.truckType,
                primaryCity: dto.primaryCity,
                slug,
                description: truckDescription,
                profileImageUrl: logoUrl ?? dto.truckImageUrl,
                coverImageUrl: dto.truckImageUrl,
                maximumGuestCapacity: 100,
                status: 'DRAFT',
                operatingStatus: 'CLOSED',
              },
            });

        if (dto.truckImageUrl) {
          const existingImage = await tx.foodTruckImage.findFirst({
            where: { foodTruckId: foodTruck.id, sortOrder: 0 },
            orderBy: { id: 'asc' },
          });

          if (existingImage) {
            await tx.foodTruckImage.update({
              where: { id: existingImage.id },
              data: {
                imageUrl: dto.truckImageUrl,
                altText: dto.truckName,
              },
            });
          } else {
            await tx.foodTruckImage.create({
              data: {
                foodTruckId: foodTruck.id,
                imageUrl: dto.truckImageUrl,
                altText: dto.truckName,
                sortOrder: 0,
              },
            });
          }
        }

        const cuisine = await tx.cuisine.upsert({
          where: { slug: slugify(dto.cuisineType) },
          create: {
            name: dto.cuisineType,
            slug: slugify(dto.cuisineType),
          },
          update: {},
        });

        await tx.foodTruckCuisine.deleteMany({
          where: { foodTruckId: foodTruck.id },
        });
        await tx.foodTruckCuisine.create({
          data: {
            foodTruckId: foodTruck.id,
            cuisineId: cuisine.id,
            isPrimary: true,
          },
        });

        const existingMainMenu = await tx.menu.findFirst({
          where: {
            foodTruckId: foodTruck.id,
            name: 'Main Menu',
          },
          include: {
            categories: true,
          },
        });

        if (existingMainMenu) {
          const categoryIds = existingMainMenu.categories.map(
            (category) => category.id,
          );

          await tx.menuItem.deleteMany({
            where: { categoryId: { in: categoryIds } },
          });
          await tx.menuCategory.deleteMany({
            where: { menuId: existingMainMenu.id },
          });
        }

        const menu = existingMainMenu
          ? await tx.menu.update({
              where: { id: existingMainMenu.id },
              data: {
                isActive: true,
                categories: {
                  create: [
                    {
                      name: 'Featured Items',
                      sortOrder: 0,
                      items: {
                        create: [
                          {
                            name: menuItem.name,
                            description: menuItem.description,
                            imageUrl: menuItemPhotoUrl,
                            price: menuItem.price,
                            sortOrder: 0,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              include: {
                categories: {
                  include: { items: true },
                },
              },
            })
          : await tx.menu.create({
              data: {
                foodTruckId: foodTruck.id,
                name: 'Main Menu',
                isActive: true,
                categories: {
                  create: [
                    {
                      name: 'Featured Items',
                      sortOrder: 0,
                      items: {
                        create: [
                          {
                            name: menuItem.name,
                            description: menuItem.description,
                            imageUrl: menuItemPhotoUrl,
                            price: menuItem.price,
                            sortOrder: 0,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              include: {
                categories: {
                  include: { items: true },
                },
              },
            });

        await tx.serviceArea.updateMany({
          where: { foodTruckId: foodTruck.id, isActive: true },
          data: { isActive: false },
        });

        const serviceAreas = await tx.$queryRaw<Array<Record<string, unknown>>>`
        INSERT INTO service_areas (
          id,
          food_truck_id,
          name,
          center_address,
          center_location,
          radius_km,
          outside_radius_allowed,
          outside_radius_fee,
          is_active
        )
        VALUES (
          gen_random_uuid(),
          ${foodTruck.id}::uuid,
          ${dto.primaryCity},
          ${dto.serviceAddress ?? null},
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusKm},
          false,
          0,
          true
        )
        RETURNING
          id,
          food_truck_id AS "foodTruckId",
          name,
          center_address AS "centerAddress",
          radius_km AS "radiusKm",
          outside_radius_allowed AS "outsideRadiusAllowed",
          outside_radius_fee AS "outsideRadiusFee",
          is_active AS "isActive"
      `;

        const existingPhotoShootRequest = dto.needsProfessionalPhotos
          ? await tx.vendorPhotoShootRequest.findFirst({
              where: {
                vendorId,
                foodTruckId: foodTruck.id,
                status: { in: ['PENDING', 'CONTACTED', 'SCHEDULED'] },
              },
              orderBy: { createdAt: 'desc' },
            })
          : null;

        const photoShootRequest = dto.needsProfessionalPhotos
          ? existingPhotoShootRequest
            ? await tx.vendorPhotoShootRequest.update({
                where: { id: existingPhotoShootRequest.id },
                data: {
                  contactName: rawContactName,
                  contactEmail,
                  contactPhone,
                  city: contactCity,
                  updatedAt: new Date(),
                },
              })
            : await tx.vendorPhotoShootRequest.create({
                data: {
                  vendorId,
                  userId,
                  foodTruckId: foodTruck.id,
                  contactName: rawContactName,
                  contactEmail,
                  contactPhone,
                  city: contactCity,
                  notes: 'Requested from vendor onboarding.',
                  status: 'PENDING',
                },
              })
          : null;

        return {
          vendor: await tx.vendor.findUnique({
            where: { id: vendorId },
            include: this.vendorInclude(),
          }),
          foodTruck: await tx.foodTruck.findUnique({
            where: { id: foodTruck.id },
            include: this.foodTruckInclude(),
          }),
          foodTruckId: foodTruck.id,
          photoShootRequestId: photoShootRequest?.id ?? null,
          menu,
          serviceArea: serviceAreas[0],
          photoShootRequest,
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }

  findPhotoShootRequests() {
    return this.prisma.vendorPhotoShootRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
        user: { include: { profile: true } },
        foodTruck: true,
      },
    });
  }

  updatePhotoShootRequest(id: string, dto: UpdatePhotoShootRequestDto) {
    return this.prisma.vendorPhotoShootRequest.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  submitVerificationRequest(
    vendorId: string,
    documents: unknown,
    notes?: string,
  ) {
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
    const averageRating =
      Math.round(Number(reviewsAggregate._avg?.rating ?? 0) * 100) / 100;
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

  updateCreditSettings(vendorId: string, enabled: boolean) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        creditAcceptanceEnabled: enabled,
        creditAcceptanceUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        creditAcceptanceEnabled: true,
        creditAcceptanceUpdatedAt: true,
      },
    });
  }

  findActiveFoodTruckIds(vendorId: string, foodTruckId?: string) {
    return this.prisma.foodTruck.findMany({
      where: {
        vendorId,
        deletedAt: null,
        ...(foodTruckId ? { id: foodTruckId } : {}),
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  countFollowers(foodTruckIds: string[]) {
    if (!foodTruckIds.length) return Promise.resolve(0);

    return this.prisma.foodTruckFollow.count({
      where: { foodTruckId: { in: foodTruckIds } },
    });
  }

  countFollowersSince(foodTruckIds: string[], start: Date) {
    if (!foodTruckIds.length) return Promise.resolve(0);

    return this.prisma.foodTruckFollow.count({
      where: {
        foodTruckId: { in: foodTruckIds },
        createdAt: { gte: start },
      },
    });
  }

  async getFollowerWeeklyChart(foodTruckIds: string[], start: Date, end: Date) {
    if (!foodTruckIds.length) {
      return [];
    }

    return this.prisma.$queryRaw<Array<{ weekIndex: number; count: bigint }>>`
      SELECT
        FLOOR(EXTRACT(DAY FROM (created_at - ${start})) / 7)::int AS "weekIndex",
        COUNT(*)::bigint AS "count"
      FROM food_truck_follows
      WHERE food_truck_id IN (${Prisma.join(foodTruckIds)})
        AND created_at >= ${start}
        AND created_at < ${end}
      GROUP BY "weekIndex"
      ORDER BY "weekIndex" ASC
    `;
  }

  async getQrScanDailyChart(foodTruckIds: string[], start: Date, end: Date) {
    if (!foodTruckIds.length) {
      return [];
    }

    return this.prisma.$queryRaw<Array<{ dayIndex: number; count: bigint }>>`
      SELECT
        FLOOR(EXTRACT(EPOCH FROM (scanned_at - ${start})) / 86400)::int AS "dayIndex",
        COUNT(*)::bigint AS "count"
      FROM qr_scans
      WHERE food_truck_id IN (${Prisma.join(foodTruckIds)})
        AND scanned_at >= ${start}
        AND scanned_at < ${end}
      GROUP BY "dayIndex"
      ORDER BY "dayIndex" ASC
    `;
  }

  async getTopScanLocations(foodTruckIds: string[], start: Date, end: Date) {
    if (!foodTruckIds.length) {
      return [];
    }

    return this.prisma.$queryRaw<
      Array<{
        latitude: number | string | null;
        longitude: number | string | null;
        scanCount: bigint;
      }>
    >`
      SELECT
        ROUND(ST_Y(scan_location::geometry)::numeric, 2) AS "latitude",
        ROUND(ST_X(scan_location::geometry)::numeric, 2) AS "longitude",
        COUNT(*)::bigint AS "scanCount"
      FROM qr_scans
      WHERE food_truck_id IN (${Prisma.join(foodTruckIds)})
        AND scan_location IS NOT NULL
        AND scanned_at >= ${start}
        AND scanned_at < ${end}
      GROUP BY "latitude", "longitude"
      ORDER BY "scanCount" DESC
      LIMIT 3
    `;
  }

  async getCreditRedemptionSummary(
    vendorId: string,
    start: Date,
    end: Date,
    previousStart: Date,
    previousEnd: Date,
  ) {
    const [current, previous] = await Promise.all([
      this.prisma.rewardRedemption.aggregate({
        where: {
          vendorId,
          status: 'COMPLETED',
          usedAt: { gte: start, lt: end },
        },
        _count: { id: true },
        _sum: { rewardValue: true },
      }),
      this.prisma.rewardRedemption.count({
        where: {
          vendorId,
          status: 'COMPLETED',
          usedAt: { gte: previousStart, lt: previousEnd },
        },
      }),
    ]);

    return {
      currentCount: current._count.id,
      currentCredit: Number(current._sum.rewardValue ?? 0),
      previousCount: previous,
    };
  }

  findRecentCreditRedemptions(vendorId: string, limit = 5) {
    return this.prisma.rewardRedemption.findMany({
      where: {
        vendorId,
        status: 'COMPLETED',
        usedAt: { not: null },
      },
      orderBy: { usedAt: 'desc' },
      take: limit,
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
          },
        },
      },
    });
  }

  vendorInclude() {
    return {
      user: {
        include: {
          profile: true,
          userRoles: true,
        },
      },
      market: true,
      activeSubscriptionTier: true,
      subscriptions: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        include: { tier: true },
      },
      verificationRequests: {
        orderBy: { createdAt: 'desc' as const },
      },
      foodTrucks: true,
    };
  }

  private foodTruckInclude() {
    return {
      images: true,
      cuisines: {
        include: {
          cuisine: true,
        },
      },
      serviceAreas: true,
      menus: {
        include: {
          categories: {
            include: {
              items: true,
            },
          },
        },
      },
    };
  }

  private async createUniqueSlug(name: string, excludeFoodTruckId?: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (
      await this.prisma.foodTruck.findFirst({
        where: {
          slug,
          ...(excludeFoodTruckId ? { id: { not: excludeFoodTruckId } } : {}),
        },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    return slug;
  }

  private limit(query: AdminListQueryDto) {
    return Math.min(query.limit ?? 20, 100);
  }

  private async ensureUniqueUserContactInfo(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string | null,
    phone: string | null,
  ) {
    if (!email && !phone) {
      return;
    }

    const orConditions = [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ];

    const existingUser = await tx.user.findFirst({
      where: {
        id: { not: userId },
        deletedAt: null,
        OR: orConditions,
      },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });

    if (!existingUser) {
      return;
    }

    if (phone && existingUser.phone === phone) {
      throw new ConflictException(
        'This phone number is already used by another account',
      );
    }

    if (email && existingUser.email === email) {
      throw new ConflictException(
        'This email address is already used by another account',
      );
    }

    throw new ConflictException(
      'This email address or phone number is already used by another account',
    );
  }
}
