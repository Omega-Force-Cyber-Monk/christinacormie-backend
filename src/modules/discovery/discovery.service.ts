import { Injectable } from '@nestjs/common';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';
import { DiscoveryRepository } from './discovery.repository';

@Injectable()
export class DiscoveryService {
  constructor(private readonly discoveryRepository: DiscoveryRepository) {}

  async getNearbyFoodTrucks(dto: NearbyFoodTrucksQueryDto) {
    const rows = await this.discoveryRepository.findNearbyFoodTrucks(dto);
    return this.toMapListResponse(rows, {
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: dto.radiusKm ?? 10,
    });
  }

  async getTrendingFoodTrucks(dto: TrendingFoodTrucksQueryDto) {
    const rows = await this.discoveryRepository.findTrendingFoodTrucks(dto);
    return this.toMapListResponse(rows);
  }

  private toMapListResponse(
    rows: Array<Record<string, unknown>>,
    center?: { latitude: number; longitude: number; radiusKm: number },
  ) {
    const items = rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      profileImageUrl: row.profileImageUrl,
      coverImageUrl: row.coverImageUrl,
      primaryImageUrl: row.primaryImageUrl,
      currentAddress: row.currentAddress,
      location: {
        latitude: row.latitude,
        longitude: row.longitude,
        updatedAt: row.locationUpdatedAt,
        validUntil: row.locationValidUntil,
      },
      distanceKm: row.distanceKm,
      operatingStatus: row.operatingStatus,
      maximumGuestCapacity: row.maximumGuestCapacity,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
      totalBookings: row.totalBookings,
      totalCheckIns: row.totalCheckIns,
      followerCount: row.followerCount,
      isFeatured: row.isFeatured,
      market: {
        city: row.city,
        state: row.state,
      },
      vendor: {
        businessName: row.vendorBusinessName,
        isVerified: row.vendorIsVerified,
      },
      cuisines: row.cuisines,
      trendingScore: row.trendingScore,
    }));

    return {
      map: {
        center,
        markers: items.map((item) => ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          latitude: item.location.latitude,
          longitude: item.location.longitude,
          operatingStatus: item.operatingStatus,
          distanceKm: item.distanceKm,
          primaryImageUrl: item.primaryImageUrl,
          cuisines: item.cuisines,
        })),
      },
      list: {
        count: items.length,
        items,
      },
    };
  }
}
