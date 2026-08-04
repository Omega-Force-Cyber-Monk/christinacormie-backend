import { Injectable } from '@nestjs/common';
import { slugify } from '../../common/utils/slug.util';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AddTruckImageDto } from './dto/add-truck-image.dto';
import { CreateFoodTruckDropDto } from './dto/create-food-truck-drop.dto';
import { CreateDraftFoodTruckDto } from './dto/create-draft-food-truck.dto';
import { CreateAvailabilityExceptionDto } from './dto/create-availability-exception.dto';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { NearbyDropsQueryDto, TodaysDropsQueryDto } from './dto/drop-query.dto';
import { SetOperatingHoursDto } from './dto/set-operating-hours.dto';
import { SetupBasicMenuDto } from './dto/setup-basic-menu.dto';
import { SetupServiceAreaDto } from './dto/setup-service-area.dto';
import { UpdateAvailabilityExceptionDto } from './dto/update-availability-exception.dto';
import { UpdateDraftFoodTruckDto } from './dto/update-draft-food-truck.dto';
import { UpdateGuestCapacityDto } from './dto/update-guest-capacity.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateOperatingStatusDto } from './dto/update-operating-status.dto';
import { UpdateTruckLocationDto } from './dto/update-truck-location.dto';
import { UpdateTruckImageDto } from './dto/update-truck-image.dto';

@Injectable()
export class FoodTrucksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findVendorByUserId(userId: string) {
    return this.prisma.vendor.findUnique({
      where: { userId },
      select: {
        id: true,
        status: true,
      },
    });
  }

  findById(id: string) {
    return this.prisma.foodTruck.findUnique({
      where: { id },
      include: this.foodTruckInclude(),
    });
  }

  findPublicBySlug(slug: string) {
    return this.prisma.foodTruck.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
      include: this.publicFoodTruckInclude(),
    });
  }

  listCuisines() {
    return this.prisma.cuisine.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findMine(vendorId: string) {
    return this.prisma.foodTruck.findMany({
      where: {
        vendorId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: this.foodTruckInclude(),
    });
  }

  async createDraft(vendorId: string, dto: CreateDraftFoodTruckDto) {
    const slug = await this.createUniqueSlug(dto.name);

    return this.prisma.foodTruck.create({
      data: {
        vendorId,
        name: dto.name,
        slug,
        description: dto.description,
        profileImageUrl: dto.profileImageUrl,
        coverImageUrl: dto.coverImageUrl,
        minimumBookingAmount: dto.minimumBookingAmount,
        maximumGuestCapacity: dto.maximumGuestCapacity,
        status: 'DRAFT',
        operatingStatus: 'CLOSED',
      },
      include: this.foodTruckInclude(),
    });
  }

  async updateDraft(foodTruckId: string, dto: UpdateDraftFoodTruckDto) {
    const data: any = {
      ...dto,
      updatedAt: new Date(),
    };

    if (dto.name) {
      data.slug = await this.createUniqueSlug(dto.name, foodTruckId);
    }

    return this.prisma.foodTruck.update({
      where: { id: foodTruckId },
      data,
      include: this.foodTruckInclude(),
    });
  }

  async setCuisines(
    foodTruckId: string,
    cuisines: Array<{
      cuisineId?: string;
      name?: string;
      pinColor?: string;
      isPrimary?: boolean;
    }>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.foodTruckCuisine.deleteMany({
        where: { foodTruckId },
      });

      for (const cuisineInput of cuisines) {
        const cuisineId =
          cuisineInput.cuisineId ??
          (
            await tx.cuisine.upsert({
              where: { slug: slugify(cuisineInput.name ?? '') },
              create: {
                name: cuisineInput.name!,
                slug: slugify(cuisineInput.name!),
                pinColor: cuisineInput.pinColor,
              },
              update: {
                pinColor: cuisineInput.pinColor,
              },
            })
          ).id;

        await tx.foodTruckCuisine.create({
          data: {
            foodTruckId,
            cuisineId,
            isPrimary: cuisineInput.isPrimary ?? false,
          },
        });
      }

      return tx.foodTruck.findUnique({
        where: { id: foodTruckId },
        include: this.foodTruckInclude(),
      });
    });
  }

  async setupBasicMenu(foodTruckId: string, dto: SetupBasicMenuDto) {
    return this.prisma.$transaction(async (tx) => {
      return tx.menu.create({
        data: {
          foodTruckId,
          name: dto.name,
          description: dto.description,
          isActive: dto.isActive ?? true,
          categories: {
            create: dto.categories.map((category) => ({
              name: category.name,
              description: category.description,
              sortOrder: category.sortOrder ?? 0,
              items: {
                create: category.items.map((item) => ({
                  name: item.name,
                  description: item.description,
                  imageUrl: item.imageUrl,
                  price: item.price,
                  isVegetarian: item.isVegetarian ?? false,
                  isVegan: item.isVegan ?? false,
                  isGlutenFree: item.isGlutenFree ?? false,
                  sortOrder: item.sortOrder ?? 0,
                })),
              },
            })),
          },
        },
        include: {
          categories: {
            include: {
              items: true,
            },
          },
        },
      });
    });
  }

  async setupServiceArea(foodTruckId: string, dto: SetupServiceAreaDto) {
    await this.prisma.serviceArea.updateMany({
      where: {
        foodTruckId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      INSERT INTO service_areas (
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
        ${foodTruckId}::uuid,
        ${dto.name ?? null},
        ${dto.centerAddress ?? null},
        ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        ${dto.radiusKm},
        ${dto.outsideRadiusAllowed ?? false},
        ${dto.outsideRadiusFee ?? 0},
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

    return rows[0];
  }

  updateGuestCapacity(foodTruckId: string, dto: UpdateGuestCapacityDto) {
    return this.prisma.foodTruck.update({
      where: { id: foodTruckId },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
      include: this.foodTruckInclude(),
    });
  }

  updateOperatingStatus(foodTruckId: string, dto: UpdateOperatingStatusDto) {
    return this.prisma.foodTruck.update({
      where: { id: foodTruckId },
      data: {
        operatingStatus: dto.operatingStatus as any,
        updatedAt: new Date(),
      },
      include: this.foodTruckInclude(),
    });
  }

  addImage(foodTruckId: string, dto: AddTruckImageDto) {
    return this.prisma.foodTruckImage.create({
      data: {
        foodTruckId,
        imageUrl: dto.imageUrl,
        altText: dto.altText,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  findImageById(id: string) {
    return this.prisma.foodTruckImage.findUnique({
      where: { id },
    });
  }

  updateImage(id: string, dto: UpdateTruckImageDto) {
    return this.prisma.foodTruckImage.update({
      where: { id },
      data: dto,
    });
  }

  removeImage(id: string) {
    return this.prisma.foodTruckImage.delete({
      where: { id },
    });
  }

  findMenuById(id: string) {
    return this.prisma.menu.findUnique({
      where: { id },
    });
  }

  createMenuCategory(menuId: string, dto: CreateMenuCategoryDto) {
    return this.prisma.menuCategory.create({
      data: {
        menuId,
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        items: true,
      },
    });
  }

  findMenuCategoryById(id: string) {
    return this.prisma.menuCategory.findUnique({
      where: { id },
      include: {
        menu: true,
      },
    });
  }

  updateMenuCategory(id: string, dto: UpdateMenuCategoryDto) {
    return this.prisma.menuCategory.update({
      where: { id },
      data: dto,
      include: {
        items: true,
      },
    });
  }

  createMenuItem(categoryId: string, dto: CreateMenuItemDto) {
    return this.prisma.menuItem.create({
      data: {
        categoryId,
        name: dto.name,
        description: dto.description,
        imageUrl: dto.imageUrl,
        price: dto.price,
        isVegetarian: dto.isVegetarian ?? false,
        isVegan: dto.isVegan ?? false,
        isGlutenFree: dto.isGlutenFree ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  findMenuItemById(id: string) {
    return this.prisma.menuItem.findUnique({
      where: { id },
      include: {
        category: {
          include: {
            menu: true,
          },
        },
      },
    });
  }

  updateMenuItem(id: string, dto: UpdateMenuItemDto) {
    return this.prisma.menuItem.update({
      where: { id },
      data: dto as any,
    });
  }

  setOperatingHours(foodTruckId: string, dto: SetOperatingHoursDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.truckOperatingHour.deleteMany({
        where: { foodTruckId },
      });

      await tx.truckOperatingHour.createMany({
        data: dto.hours.map((hour) => ({
          foodTruckId,
          dayOfWeek: hour.dayOfWeek,
          openingTime: hour.openingTime ? this.toTimeDate(hour.openingTime) : null,
          closingTime: hour.closingTime ? this.toTimeDate(hour.closingTime) : null,
          isClosed: hour.isClosed,
        })),
      });

      return tx.truckOperatingHour.findMany({
        where: { foodTruckId },
        orderBy: { dayOfWeek: 'asc' },
      });
    });
  }

  createAvailabilityException(
    foodTruckId: string,
    dto: CreateAvailabilityExceptionDto,
  ) {
    return this.prisma.truckAvailabilityException.upsert({
      where: {
        foodTruckId_exceptionDate: {
          foodTruckId,
          exceptionDate: this.toDateOnly(dto.exceptionDate),
        },
      },
      create: {
        foodTruckId,
        exceptionDate: this.toDateOnly(dto.exceptionDate),
        isAvailable: dto.isAvailable,
        openingTime: dto.openingTime ? this.toTimeDate(dto.openingTime) : null,
        closingTime: dto.closingTime ? this.toTimeDate(dto.closingTime) : null,
        reason: dto.reason,
      },
      update: {
        isAvailable: dto.isAvailable,
        openingTime: dto.openingTime ? this.toTimeDate(dto.openingTime) : null,
        closingTime: dto.closingTime ? this.toTimeDate(dto.closingTime) : null,
        reason: dto.reason,
      },
    });
  }

  findAvailabilityExceptionById(id: string) {
    return this.prisma.truckAvailabilityException.findUnique({
      where: { id },
    });
  }

  updateAvailabilityException(id: string, dto: UpdateAvailabilityExceptionDto) {
    const data: any = {
      ...dto,
    };

    if (dto.exceptionDate) {
      data.exceptionDate = this.toDateOnly(dto.exceptionDate);
    }

    if (dto.openingTime !== undefined) {
      data.openingTime = dto.openingTime ? this.toTimeDate(dto.openingTime) : null;
    }

    if (dto.closingTime !== undefined) {
      data.closingTime = dto.closingTime ? this.toTimeDate(dto.closingTime) : null;
    }

    return this.prisma.truckAvailabilityException.update({
      where: { id },
      data,
    });
  }

  async updateLocation(foodTruckId: string, dto: UpdateTruckLocationDto) {
    const now = new Date();
    const validUntil = dto.validForMinutes
      ? new Date(now.getTime() + dto.validForMinutes * 60_000)
      : null;

    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      UPDATE food_trucks
      SET
        current_address = ${dto.address ?? null},
        current_location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
        location_updated_at = ${now},
        location_valid_until = ${validUntil},
        updated_at = ${now}
      WHERE id = ${foodTruckId}::uuid
      RETURNING
        id,
        current_address AS "currentAddress",
        ST_Y(current_location::geometry) AS latitude,
        ST_X(current_location::geometry) AS longitude,
        location_updated_at AS "locationUpdatedAt",
        location_valid_until AS "locationValidUntil",
        operating_status AS "operatingStatus"
    `;

    return rows[0];
  }

  async createActiveDrop(foodTruckId: string, dto: CreateFoodTruckDropDto) {
    const now = new Date();
    const endsAt = dto.durationMinutes
      ? new Date(now.getTime() + dto.durationMinutes * 60_000)
      : null;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        UPDATE food_trucks
        SET
          current_address = ${dto.address ?? null},
          current_location = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
          location_updated_at = ${now},
          location_valid_until = ${endsAt},
          updated_at = ${now}
        WHERE id = ${foodTruckId}::uuid
      `;

      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        INSERT INTO food_truck_drops (
          food_truck_id,
          title,
          message,
          address,
          location,
          starts_at,
          ends_at
        )
        VALUES (
          ${foodTruckId}::uuid,
          ${dto.title ?? null},
          ${dto.message ?? null},
          ${dto.address ?? null},
          ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
          ${now},
          ${endsAt}
        )
        RETURNING
          id,
          food_truck_id AS "foodTruckId",
          title,
          message,
          address,
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          starts_at AS "startsAt",
          ends_at AS "endsAt",
          status,
          created_at AS "createdAt"
      `;

      return rows[0];
    });
  }

  findNearbyActiveDrops(dto: NearbyDropsQueryDto) {
    const now = new Date();
    const radiusMeters = (dto.radiusKm ?? 10) * 1000;
    const limit = dto.limit ?? 50;

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        d.id,
        d.title,
        d.message,
        d.address,
        ST_Y(d.location::geometry) AS latitude,
        ST_X(d.location::geometry) AS longitude,
        d.starts_at AS "startsAt",
        d.ends_at AS "endsAt",
        d.status,
        ROUND(
          (
            ST_Distance(
              d.location,
              ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
            ) / 1000
          )::numeric,
          2
        ) AS "distanceKm",
        f.id AS "foodTruckId",
        f.name AS "foodTruckName",
        f.slug AS "foodTruckSlug",
        f.profile_image_url AS "profileImageUrl",
        f.cover_image_url AS "coverImageUrl",
        f.operating_status AS "operatingStatus",
        f.average_rating AS "averageRating",
        f.total_reviews AS "totalReviews",
        v.business_name AS "vendorBusinessName",
        v.is_verified AS "vendorIsVerified"
      FROM food_truck_drops d
      INNER JOIN food_trucks f ON f.id = d.food_truck_id
      INNER JOIN vendors v ON v.id = f.vendor_id
      WHERE
        d.status = 'ACTIVE'
        AND d.starts_at <= ${now}
        AND (d.ends_at IS NULL OR d.ends_at >= ${now})
        AND f.status = 'ACTIVE'
        AND f.deleted_at IS NULL
        AND ST_DWithin(
          d.location,
          ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceKm" ASC, d.starts_at DESC
      LIMIT ${limit}
    `;
  }

  findTodaysDrops(dto: TodaysDropsQueryDto, startOfDay: Date, endOfDay: Date) {
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      return this.findTodaysDropsNearLocation(dto, startOfDay, endOfDay);
    }

    const limit = dto.limit ?? 50;

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        d.id,
        d.title,
        d.message,
        d.address,
        ST_Y(d.location::geometry) AS latitude,
        ST_X(d.location::geometry) AS longitude,
        d.starts_at AS "startsAt",
        d.ends_at AS "endsAt",
        d.status,
        f.id AS "foodTruckId",
        f.name AS "foodTruckName",
        f.slug AS "foodTruckSlug",
        f.profile_image_url AS "profileImageUrl",
        f.operating_status AS "operatingStatus",
        v.business_name AS "vendorBusinessName",
        v.is_verified AS "vendorIsVerified"
      FROM food_truck_drops d
      INNER JOIN food_trucks f ON f.id = d.food_truck_id
      INNER JOIN vendors v ON v.id = f.vendor_id
      WHERE
        d.starts_at >= ${startOfDay}
        AND d.starts_at < ${endOfDay}
        AND d.status <> 'CANCELLED'
        AND f.status = 'ACTIVE'
        AND f.deleted_at IS NULL
      ORDER BY d.starts_at ASC
      LIMIT ${limit}
    `;
  }

  private findTodaysDropsNearLocation(
    dto: TodaysDropsQueryDto,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const latitude = dto.latitude!;
    const longitude = dto.longitude!;
    const radiusMeters = (dto.radiusKm ?? 25) * 1000;
    const limit = dto.limit ?? 50;

    return this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        d.id,
        d.title,
        d.message,
        d.address,
        ST_Y(d.location::geometry) AS latitude,
        ST_X(d.location::geometry) AS longitude,
        d.starts_at AS "startsAt",
        d.ends_at AS "endsAt",
        d.status,
        ROUND(
          (
            ST_Distance(
              d.location,
              ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
            ) / 1000
          )::numeric,
          2
        ) AS "distanceKm",
        f.id AS "foodTruckId",
        f.name AS "foodTruckName",
        f.slug AS "foodTruckSlug",
        f.profile_image_url AS "profileImageUrl",
        f.operating_status AS "operatingStatus",
        v.business_name AS "vendorBusinessName",
        v.is_verified AS "vendorIsVerified"
      FROM food_truck_drops d
      INNER JOIN food_trucks f ON f.id = d.food_truck_id
      INNER JOIN vendors v ON v.id = f.vendor_id
      WHERE
        d.starts_at >= ${startOfDay}
        AND d.starts_at < ${endOfDay}
        AND d.status <> 'CANCELLED'
        AND f.status = 'ACTIVE'
        AND f.deleted_at IS NULL
        AND ST_DWithin(
          d.location,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceKm" ASC, d.starts_at ASC
      LIMIT ${limit}
    `;
  }

  private async createUniqueSlug(name: string, excludeFoodTruckId?: string): Promise<string> {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.foodTruck.findFirst({
        where: {
          slug,
          ...(excludeFoodTruckId ? { id: { not: excludeFoodTruckId } } : {}),
        },
        select: { id: true },
      })
    ) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return slug;
  }

  private foodTruckInclude() {
    return {
      images: true,
      cuisines: {
        include: {
          cuisine: true,
        },
      },
      menus: {
        include: {
          categories: {
            include: {
              items: true,
            },
          },
        },
      },
      serviceAreas: true,
      operatingHours: {
        orderBy: { dayOfWeek: 'asc' as const },
      },
      availabilityExceptions: {
        orderBy: { exceptionDate: 'asc' as const },
      },
    };
  }

  private publicFoodTruckInclude() {
    return {
      vendor: {
        select: {
          id: true,
          businessName: true,
          logoUrl: true,
          isVerified: true,
          reliabilityScore: true,
        },
      },
      market: true,
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
      cuisines: {
        include: {
          cuisine: true,
        },
      },
      menus: {
        where: { isActive: true },
        include: {
          categories: {
            orderBy: { sortOrder: 'asc' as const },
            include: {
              items: {
                orderBy: { sortOrder: 'asc' as const },
              },
            },
          },
        },
      },
      serviceAreas: {
        where: { isActive: true },
      },
      operatingHours: {
        orderBy: { dayOfWeek: 'asc' as const },
      },
      availabilityExceptions: {
        orderBy: { exceptionDate: 'asc' as const },
      },
    };
  }

  private toDateOnly(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private toTimeDate(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }
}
