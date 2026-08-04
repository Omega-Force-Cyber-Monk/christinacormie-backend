import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';

type QueryValue = string | number | boolean | Date;

@Injectable()
export class DiscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findNearbyFoodTrucks(dto: NearbyFoodTrucksQueryDto) {
    const values: QueryValue[] = [];
    const longitude = this.addParam(values, dto.longitude);
    const latitude = this.addParam(values, dto.latitude);
    const radiusMeters = this.addParam(values, (dto.radiusKm ?? 10) * 1000);
    const limit = this.addParam(values, dto.limit ?? 50);
    const userPoint = `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`;
    const where = [
      ...this.baseWhere(),
      `f.current_location IS NOT NULL`,
      `(f.location_valid_until IS NULL OR f.location_valid_until >= NOW())`,
      `ST_DWithin(f.current_location, ${userPoint}, ${radiusMeters})`,
      ...this.filterWhere(dto, values),
    ];

    const sql = `
      ${this.selectFoodTruckFields(`ROUND((ST_Distance(f.current_location, ${userPoint}) / 1000)::numeric, 2) AS "distanceKm",`)}
      WHERE ${where.join(' AND ')}
      GROUP BY f.id, m.id, v.id, img.image_url
      ORDER BY "distanceKm" ASC
      LIMIT ${limit}
    `;

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      sql,
      ...values,
    );
  }

  findTrendingFoodTrucks(dto: TrendingFoodTrucksQueryDto) {
    const values: QueryValue[] = [];
    const limit = this.addParam(values, dto.limit ?? 20);
    const where = [
      ...this.baseWhere(),
      `f.current_location IS NOT NULL`,
      ...this.filterWhere(dto, values),
    ];

    const sql = `
      ${this.selectFoodTruckFields(`
        NULL::numeric AS "distanceKm",
        (
          f.follower_count * 2
          + f.total_check_ins * 3
          + f.total_bookings * 4
          + f.total_reviews
          + CASE WHEN f.is_featured THEN 10 ELSE 0 END
        ) AS "trendingScore",
      `)}
      WHERE ${where.join(' AND ')}
      GROUP BY f.id, m.id, v.id, img.image_url
      ORDER BY "trendingScore" DESC, f.average_rating DESC, f.total_reviews DESC
      LIMIT ${limit}
    `;

    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      sql,
      ...values,
    );
  }

  private selectFoodTruckFields(extraSelect: string) {
    return `
      SELECT
        f.id,
        f.name,
        f.slug,
        f.description,
        f.profile_image_url AS "profileImageUrl",
        f.cover_image_url AS "coverImageUrl",
        img.image_url AS "primaryImageUrl",
        f.current_address AS "currentAddress",
        ST_Y(f.current_location::geometry) AS latitude,
        ST_X(f.current_location::geometry) AS longitude,
        f.location_updated_at AS "locationUpdatedAt",
        f.location_valid_until AS "locationValidUntil",
        f.operating_status AS "operatingStatus",
        f.maximum_guest_capacity AS "maximumGuestCapacity",
        f.average_rating AS "averageRating",
        f.total_reviews AS "totalReviews",
        f.total_bookings AS "totalBookings",
        f.total_check_ins AS "totalCheckIns",
        f.follower_count AS "followerCount",
        f.is_featured AS "isFeatured",
        m.city,
        m.state,
        v.business_name AS "vendorBusinessName",
        v.is_verified AS "vendorIsVerified",
        ${extraSelect}
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'pinColor', c.pin_color,
              'isPrimary', ftc.is_primary
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::jsonb
        ) AS cuisines
      FROM food_trucks f
      INNER JOIN vendors v ON v.id = f.vendor_id
      LEFT JOIN markets m ON m.id = f.market_id
      LEFT JOIN food_truck_cuisines ftc ON ftc.food_truck_id = f.id
      LEFT JOIN cuisines c ON c.id = ftc.cuisine_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM food_truck_images
        WHERE food_truck_id = f.id
        ORDER BY sort_order ASC
        LIMIT 1
      ) img ON true
    `;
  }

  private baseWhere() {
    return [`f.status = 'ACTIVE'`, `f.deleted_at IS NULL`];
  }

  private filterWhere(
    dto: NearbyFoodTrucksQueryDto | TrendingFoodTrucksQueryDto,
    values: QueryValue[],
  ) {
    const where: string[] = [];

    if (dto.openOnly) {
      where.push(`f.operating_status = 'OPEN'`);
    }

    if (dto.cuisineId || dto.cuisineSlug || dto.cuisine) {
      const cuisineConditions: string[] = [];

      if (dto.cuisineId) {
        cuisineConditions.push(`c2.id = ${this.addParam(values, dto.cuisineId)}::uuid`);
      }

      if (dto.cuisineSlug) {
        cuisineConditions.push(`c2.slug = ${this.addParam(values, dto.cuisineSlug)}`);
      }

      if (dto.cuisine) {
        cuisineConditions.push(`c2.name ILIKE ${this.addParam(values, `%${dto.cuisine}%`)}`);
      }

      where.push(`
        EXISTS (
          SELECT 1
          FROM food_truck_cuisines ftc2
          INNER JOIN cuisines c2 ON c2.id = ftc2.cuisine_id
          WHERE ftc2.food_truck_id = f.id
            AND (${cuisineConditions.join(' OR ')})
        )
      `);
    }

    if (dto.search) {
      where.push(`f.name ILIKE ${this.addParam(values, `%${dto.search}%`)}`);
    }

    if (dto.area) {
      const area = this.addParam(values, `%${dto.area}%`);
      where.push(`
        (
          f.current_address ILIKE ${area}
          OR m.city ILIKE ${area}
          OR m.state ILIKE ${area}
          OR EXISTS (
            SELECT 1
            FROM service_areas sa
            WHERE sa.food_truck_id = f.id
              AND sa.is_active = true
              AND (sa.name ILIKE ${area} OR sa.center_address ILIKE ${area})
          )
        )
      `);
    }

    if (dto.city) {
      const city = this.addParam(values, `%${dto.city}%`);
      where.push(`(m.city ILIKE ${city} OR f.current_address ILIKE ${city})`);
    }

    return where;
  }

  private addParam(values: QueryValue[], value: QueryValue) {
    values.push(value);
    return `$${values.length}`;
  }
}
