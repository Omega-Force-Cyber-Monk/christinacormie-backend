import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardsService } from './leaderboards.service';

const errorExample = (
  statusCode: number,
  message: string | string[],
  error: string,
) => ({
  statusCode,
  message,
  error,
});

const marketExample = {
  id: 'market-id',
  name: 'Austin Metro',
  city: 'Austin',
  state: 'TX',
  country: 'USA',
  timezone: 'America/Chicago',
  operatingRadiusKm: 40,
  status: 'ACTIVE',
};

const leaderboardEntryExample = {
  id: 'leaderboard-entry-id',
  leaderboardId: 'leaderboard-id',
  vendorId: 'vendor-id',
  foodTruckId: 'food-truck-id',
  rank: 1,
  previousRank: 2,
  score: 98.75,
  bookingScore: 35,
  ratingScore: 24,
  reliabilityScore: 20,
  engagementScore: 12,
  checkInScore: 7.75,
  createdAt: '2026-09-08T06:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  vendor: {
    id: 'vendor-id',
    businessName: 'Taco Paradise',
    status: 'APPROVED',
    isVerified: true,
    reliabilityScore: 96.5,
  },
  foodTruck: {
    id: 'food-truck-id',
    name: 'Taco Paradise',
    slug: 'taco-paradise',
    description: 'Authentic gourmet street tacos & fresh salsas',
    profileImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise.jpg',
    coverImageUrl: 'https://cdn.bitedrop.com/trucks/taco-paradise-cover.jpg',
    averageRating: 4.8,
    totalReviews: 102,
    totalBookings: 185,
    totalCheckIns: 16500,
    followerCount: 12500,
  },
};

const leaderboardExample = {
  id: 'leaderboard-id',
  marketId: 'market-id',
  ruleId: 'leaderboard-rule-id',
  title: 'Top Rated Food Trucks',
  slug: 'top-rated-food-trucks',
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-09-30T23:59:59.000Z',
  calculatedAt: '2026-09-08T06:00:00.000Z',
  isActive: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-08T06:00:00.000Z',
  market: marketExample,
  rule: {
    id: 'leaderboard-rule-id',
    type: 'TOP_RATED',
    period: 'MONTHLY',
    bookingWeight: 0,
    ratingWeight: 20,
    reliabilityWeight: 0,
    engagementWeight: 0,
    checkInWeight: 0,
    minimumCompletedBookings: 0,
    isActive: true,
  },
  entries: [leaderboardEntryExample],
};

@ApiTags('Leaderboards')
@Controller('api/v1/leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @ApiOperation({ summary: 'List all active leaderboards' })
  @ApiResponse({
    status: 200,
    description: 'Active leaderboards returned successfully.',
    schema: { example: [leaderboardExample] },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be greater than 100'],
        'Bad Request',
      ),
    },
  })
  @Get()
  getLeaderboards(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboards(query);
  }

  @ApiOperation({ summary: 'Get top-rated food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Top-rated leaderboard returned successfully.',
    schema: { example: leaderboardExample },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['period must be a valid enum value'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Top-rated leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'TOP_RATED' not found",
        'Not Found',
      ),
    },
  })
  @Get('top-rated')
  getTopRated(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('TOP_RATED', query);
  }

  @ApiOperation({ summary: 'Get most booked food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Most-booked leaderboard returned successfully.',
    schema: {
      example: {
        ...leaderboardExample,
        title: 'Most Booked Food Trucks',
        slug: 'most-booked-food-trucks',
        rule: { ...leaderboardExample.rule, type: 'MOST_BOOKED' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(400, ['marketId must be a UUID'], 'Bad Request'),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Most-booked leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'MOST_BOOKED' not found",
        'Not Found',
      ),
    },
  })
  @Get('most-booked')
  getMostBooked(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('MOST_BOOKED', query);
  }

  @ApiOperation({ summary: 'Get most visited food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Most-visited leaderboard returned successfully.',
    schema: {
      example: {
        ...leaderboardExample,
        title: 'Most Visited Food Trucks',
        slug: 'most-visited-food-trucks',
        rule: { ...leaderboardExample.rule, type: 'MOST_VISITED' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be less than 1'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Most-visited leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'MOST_VISITED' not found",
        'Not Found',
      ),
    },
  })
  @Get('most-visited')
  getMostVisited(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('MOST_VISITED', query);
  }

  @ApiOperation({ summary: 'Get trending food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Trending leaderboard returned successfully.',
    schema: {
      example: {
        ...leaderboardExample,
        title: 'Trending Food Trucks',
        slug: 'trending-food-trucks',
        rule: { ...leaderboardExample.rule, type: 'TRENDING' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['offset must not be less than 0'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Trending leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'TRENDING' not found",
        'Not Found',
      ),
    },
  })
  @Get('trending')
  getTrending(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('TRENDING', query);
  }

  @ApiOperation({ summary: 'Get most followed food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Most-followed leaderboard returned successfully.',
    schema: {
      example: {
        ...leaderboardExample,
        title: 'Most Followed Food Trucks',
        slug: 'most-followed-food-trucks',
        rule: { ...leaderboardExample.rule, type: 'MOST_ENGAGED' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['limit must not be greater than 100'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Most-followed leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'MOST_ENGAGED' not found",
        'Not Found',
      ),
    },
  })
  @Get('most-followed')
  getMostFollowed(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('MOST_ENGAGED', query);
  }

  @ApiOperation({ summary: 'Get rising food trucks leaderboard' })
  @ApiResponse({
    status: 200,
    description: 'Rising leaderboard returned successfully.',
    schema: {
      example: {
        ...leaderboardExample,
        title: 'Rising Food Trucks',
        slug: 'rising-food-trucks',
        rule: { ...leaderboardExample.rule, type: 'RISING' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Query validation failed.',
    schema: {
      example: errorExample(
        400,
        ['period must be a valid enum value'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Rising leaderboard was not found.',
    schema: {
      example: errorExample(
        404,
        "Leaderboard for type 'RISING' not found",
        'Not Found',
      ),
    },
  })
  @Get('rising')
  getRising(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('RISING', query);
  }

  @ApiOperation({ summary: 'Get leaderboard rankings by leaderboard ID' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard rankings returned successfully by ID.',
    schema: { example: leaderboardExample },
  })
  @ApiResponse({
    status: 400,
    description:
      'Query validation failed. limit and offset should be numeric query values.',
    schema: {
      example: errorExample(
        400,
        ['limit must be a number string'],
        'Bad Request',
      ),
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Leaderboard was not found.',
    schema: {
      example: errorExample(404, 'Leaderboard not found', 'Not Found'),
    },
  })
  @Get(':leaderboardId')
  getLeaderboardById(
    @Param('leaderboardId') leaderboardId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.leaderboardsService.getLeaderboardById(
      leaderboardId,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }
}
