import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('Discovery')
@Controller('api/v1/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @ApiOperation({ summary: 'Discover nearby food trucks using PostGIS location search' })
  @Get('nearby')
  getNearbyFoodTrucks(@Query() query: NearbyFoodTrucksQueryDto) {
    return this.discoveryService.getNearbyFoodTrucks(query);
  }

  @ApiOperation({ summary: 'Discover trending and popular food trucks' })
  @Get('trending')
  getTrendingFoodTrucks(@Query() query: TrendingFoodTrucksQueryDto) {
    return this.discoveryService.getTrendingFoodTrucks(query);
  }
}
