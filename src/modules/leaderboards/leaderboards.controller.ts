import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardsService } from './leaderboards.service';

@ApiTags('Leaderboards')
@Controller('api/v1/leaderboards')
export class LeaderboardsController {
  constructor(private readonly leaderboardsService: LeaderboardsService) {}

  @ApiOperation({ summary: 'List all active leaderboards' })
  @Get()
  getLeaderboards(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboards(query);
  }

  @ApiOperation({ summary: 'Get top-rated food trucks leaderboard' })
  @Get('top-rated')
  getTopRated(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('TOP_RATED', query);
  }

  @ApiOperation({ summary: 'Get most booked food trucks leaderboard' })
  @Get('most-booked')
  getMostBooked(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('MOST_BOOKED', query);
  }

  @ApiOperation({ summary: 'Get most visited food trucks leaderboard' })
  @Get('most-visited')
  getMostVisited(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('MOST_VISITED', query);
  }

  @ApiOperation({ summary: 'Get trending food trucks leaderboard' })
  @Get('trending')
  getTrending(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardsService.getLeaderboardByType('TRENDING', query);
  }

  @ApiOperation({ summary: 'Get leaderboard rankings by leaderboard ID' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
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
