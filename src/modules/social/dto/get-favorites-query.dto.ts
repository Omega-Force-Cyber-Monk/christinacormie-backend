import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum FavoriteTab {
  ALL = 'ALL',
  OPEN = 'OPEN',
}

export class GetFavoritesQueryDto {
  @ApiPropertyOptional({
    enum: FavoriteTab,
    default: FavoriteTab.ALL,
    description: 'Filter by tab: ALL or OPEN',
  })
  @IsOptional()
  @IsEnum(FavoriteTab)
  tab?: FavoriteTab = FavoriteTab.ALL;

  @ApiPropertyOptional({
    description: 'Search favorite trucks by name or cuisine',
    example: 'Taco',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'User latitude for distance calculation',
    example: 37.7749,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description: 'User longitude for distance calculation',
    example: -122.4194,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}
