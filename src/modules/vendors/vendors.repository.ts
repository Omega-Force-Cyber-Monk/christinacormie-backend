import { Injectable } from '@nestjs/common';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
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

  async completeOnboarding(
    userId: string,
    vendorId: string,
    dto: CompleteVendorOnboardingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const selectedPlan = dto.selectedPlan ?? dto.plan ?? 'FREE';
      const rawContactName = dto.contactName ?? dto.contact?.name ?? 'Vendor';
      const [firstName, ...lastNameParts] = rawContactName.trim().split(/\s+/);
      const lastName = lastNameParts.join(' ') || undefined;
      const contactCity = dto.city ?? dto.contact?.city ?? dto.primaryCity ?? 'Austin';
      const contactState = dto.state ?? dto.contact?.state ?? 'TX';
      const contactEmail = (dto.email ?? dto.contact?.email ?? '').toLowerCase();
      const contactPhone = dto.phoneNumber ?? dto.phone ?? dto.contact?.phoneNumber;
      const logoUrl = dto.logoUrl ?? dto.truckLogoUrl;
      const menuItem = dto.firstMenuItem ?? dto.menuItem ?? { name: 'Featured Item', price: 10 };
      const menuItemPhotoUrl = menuItem.photoUrl ?? menuItem.imageUrl;
      const radiusKm = dto.serviceRadiusKm ?? dto.serviceRadius ?? 20;
      const latitude = dto.latitude ?? 30.2672;
      const longitude = dto.longitude ?? -97.7431;

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
      const slug = await this.createUniqueSlug(dto.truckName, existingTruck?.id);
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

      await tx.foodTruckCuisine.deleteMany({ where: { foodTruckId: foodTruck.id } });
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
        const categoryIds = existingMainMenu.categories.map((category) => category.id);

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
    });
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
}
