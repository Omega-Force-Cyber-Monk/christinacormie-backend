import { Controller, Get, Query } from '@nestjs/common';
import {
  NearbyFoodTrucksQueryDto,
  TrendingFoodTrucksQueryDto,
} from './dto/discovery-query.dto';
import { DiscoveryService } from './discovery.service';

@Controller('api/v1/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('nearby')
  getNearbyFoodTrucks(@Query() query: NearbyFoodTrucksQueryDto) {
    return this.discoveryService.getNearbyFoodTrucks(query);
  }

  @Get('trending')
  getTrendingFoodTrucks(@Query() query: TrendingFoodTrucksQueryDto) {
    return this.discoveryService.getTrendingFoodTrucks(query);
  }
}
