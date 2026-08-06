import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === true || value === 'true') {
    return true;
  }

  if (value === false || value === 'false') {
    return false;
  }

  return value;
};

export class NearbyFoodTrucksQueryDto {
  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radiusKm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({ example: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66' })
  @IsOptional()
  @IsUUID()
  cuisineId?: string;

  @ApiPropertyOptional({ example: 'mexican-tacos' })
  @IsOptional()
  @IsString()
  cuisineSlug?: string;

  @ApiPropertyOptional({ example: 'Mexican' })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({ example: 'tacos' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'Downtown' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class TrendingFoodTrucksQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  openOnly?: boolean;

  @ApiPropertyOptional({ example: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66' })
  @IsOptional()
  @IsUUID()
  cuisineId?: string;

  @ApiPropertyOptional({ example: 'mexican-tacos' })
  @IsOptional()
  @IsString()
  cuisineSlug?: string;

  @ApiPropertyOptional({ example: 'Mexican' })
  @IsOptional()
  @IsString()
  cuisine?: string;

  @ApiPropertyOptional({ example: 'burger' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'Downtown' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
