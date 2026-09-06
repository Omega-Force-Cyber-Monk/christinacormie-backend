import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';
import { DiscoveryRepository } from './discovery.repository';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(private readonly discoveryRepository: DiscoveryRepository) {}

  async getNearbyFoodTrucks(dto: NearbyFoodTrucksQueryDto) {
    try {
      const rows = await this.discoveryRepository.findNearbyFoodTrucks(dto);
      return this.toFoodTruckListResponse(rows, {
        latitude: dto.latitude,
        longitude: dto.longitude,
        radiusKm: dto.radiusKm ?? 10,
      });
    } catch (error) {
      this.logger.error(
        'Failed to load nearby food trucks',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Unable to load nearby food trucks. Please check your location filters and try again.',
      );
    }
  }

  async getTrendingFoodTrucks(dto: TrendingFoodTrucksQueryDto) {
    try {
      const rows = await this.discoveryRepository.findTrendingFoodTrucks(dto);
      return this.toFoodTruckListResponse(rows);
    } catch (error) {
      this.logger.error(
        'Failed to load trending food trucks',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'Unable to load trending food trucks. Please check your filters and try again.',
      );
    }
  }

  private toFoodTruckListResponse(
    rows: Array<Record<string, unknown>>,
    center?: { latitude: number; longitude: number; radiusKm: number },
  ) {
    const foodTrucks = rows.map((row) => {
      const cuisines = this.toCuisines(row.cuisines);
      const trendingScore = this.toNumberOrNull(row.trendingScore);

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        imageUrl:
          row.primaryImageUrl ?? row.profileImageUrl ?? row.coverImageUrl,
        address: row.currentAddress,
        location: {
          latitude: this.toNumberOrNull(row.latitude),
          longitude: this.toNumberOrNull(row.longitude),
        },
        distanceKm: this.toNumberOrNull(row.distanceKm),
        operatingStatus: row.operatingStatus,
        rating: this.toNumberOrNull(row.averageRating),
        reviewCount: this.toNumberOrNull(row.totalReviews),
        isFeatured: row.isFeatured,
        vendor: {
          businessName: row.vendorBusinessName,
          isVerified: row.vendorIsVerified,
        },
        cuisines,
        primaryCuisine: cuisines.find((cuisine) => cuisine.isPrimary) ?? null,
        ...(trendingScore === null ? {} : { trendingScore }),
      };
    });

    return {
      meta: {
        count: foodTrucks.length,
        ...(center
          ? {
              center: {
                latitude: center.latitude,
                longitude: center.longitude,
              },
              radiusKm: center.radiusKm,
            }
          : {}),
      },
      foodTrucks,
    };
  }

  private toCuisines(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((cuisine) => {
      const cuisineValue = cuisine as Record<string, unknown>;

      return {
        id: cuisineValue.id,
        name: cuisineValue.name,
        slug: cuisineValue.slug,
        pinColor: cuisineValue.pinColor,
        isPrimary: Boolean(cuisineValue.isPrimary),
      };
    });
  }

  private toNumberOrNull(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return null;
    }

    return numberValue;
  }
}
