import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';
import { DiscoveryService } from './discovery.service';

const foodTruckListExample = {
  meta: {
    count: 1,
    center: {
      latitude: 37.7749,
      longitude: -122.4194,
    },
    radiusKm: 10,
  },
  foodTrucks: [
    {
      id: 'a7984958-4fb9-456b-b6ff-c3388d94bc7d',
      name: 'Seafood Splash',
      slug: 'seafood-splash',
      description: 'Top rated Seafood Splash gourmet food truck',
      imageUrl:
        'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400',
      address: '200 Grove St, San Francisco, CA',
      location: {
        latitude: 37.776,
        longitude: -122.42,
      },
      distanceKm: 0.13,
      operatingStatus: 'OPEN',
      rating: 4.5,
      reviewCount: 380,
      isFeatured: false,
      vendor: {
        businessName: 'Demo Gourmet Bites',
        isVerified: true,
      },
      cuisines: [
        {
          id: '63f5d95a-ad1a-4b94-ab4e-441750dc57a5',
          name: 'Seafood',
          slug: 'seafood',
          pinColor: '#00BCD4',
          isPrimary: true,
        },
      ],
      primaryCuisine: {
        id: '63f5d95a-ad1a-4b94-ab4e-441750dc57a5',
        name: 'Seafood',
        slug: 'seafood',
        pinColor: '#00BCD4',
        isPrimary: true,
      },
    },
  ],
};

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

@ApiTags('Discovery')
@Controller('api/v1/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @ApiOperation({
    summary: 'Discover nearby food trucks using PostGIS location search',
  })
  @ApiResponse({
    status: 200,
    description:
      'Clean food truck list for both map markers and nearby list cards.',
    schema: {
      example: foodTruckListExample,
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid nearby search query parameters.',
    schema: {
      example: errorExample(
        400,
        [
          'latitude is required and must be a valid number between -90 and 90',
          'radiusKm cannot be greater than 100 km',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Nearby discovery search failed.',
    schema: {
      example: errorExample(
        500,
        'Unable to load nearby food trucks. Please check your location filters and try again.',
        'Internal Server Error',
      ),
    },
  })
  @Get('nearby')
  getNearbyFoodTrucks(@Query() query: NearbyFoodTrucksQueryDto) {
    return this.discoveryService.getNearbyFoodTrucks(query);
  }

  @ApiOperation({ summary: 'Discover trending and popular food trucks' })
  @ApiResponse({
    status: 200,
    description: 'Clean food truck list ordered by trending score.',
    schema: {
      example: {
        ...foodTruckListExample,
        meta: {
          count: 1,
        },
        foodTrucks: [
          {
            ...foodTruckListExample.foodTrucks[0],
            distanceKm: null,
            trendingScore: 12048,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid trending search query parameters.',
    schema: {
      example: errorExample(
        400,
        [
          'minRating cannot be greater than 5',
          'limit cannot be greater than 100',
        ],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Trending discovery search failed.',
    schema: {
      example: errorExample(
        500,
        'Unable to load trending food trucks. Please check your filters and try again.',
        'Internal Server Error',
      ),
    },
  })
  @Get('trending')
  getTrendingFoodTrucks(@Query() query: TrendingFoodTrucksQueryDto) {
    return this.discoveryService.getTrendingFoodTrucks(query);
  }
}
