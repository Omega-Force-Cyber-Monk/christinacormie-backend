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
  MaxLength,
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
  @IsLatitude({
    message:
      'latitude is required and must be a valid number between -90 and 90',
  })
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude({
    message:
      'longitude is required and must be a valid number between -180 and 180',
  })
  longitude: number;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'radiusKm must be a number' })
  @Min(0.1, { message: 'radiusKm must be at least 0.1 km' })
  @Max(100, { message: 'radiusKm cannot be greater than 100 km' })
  radiusKm?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'openOnly must be true or false' })
  openOnly?: boolean;

  @ApiPropertyOptional({ example: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66' })
  @IsOptional()
  @IsUUID(undefined, { message: 'cuisineId must be a valid UUID' })
  cuisineId?: string;

  @ApiPropertyOptional({ example: 'mexican-tacos' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'cuisineSlug must be a string' })
  @MaxLength(100, {
    message: 'cuisineSlug cannot be longer than 100 characters',
  })
  cuisineSlug?: string;

  @ApiPropertyOptional({ example: 'Mexican' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'cuisine must be a string' })
  @MaxLength(100, { message: 'cuisine cannot be longer than 100 characters' })
  cuisine?: string;

  @ApiPropertyOptional({ example: 'tacos' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search cannot be longer than 100 characters' })
  search?: string;

  @ApiPropertyOptional({ example: 'Downtown' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'area must be a string' })
  @MaxLength(100, { message: 'area cannot be longer than 100 characters' })
  area?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'city must be a string' })
  @MaxLength(100, { message: 'city cannot be longer than 100 characters' })
  city?: string;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Minimum average rating (e.g. 3.0, 3.5, 4.0, 4.5)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minRating must be a number' })
  @Min(1, { message: 'minRating must be at least 1' })
  @Max(5, { message: 'minRating cannot be greater than 5' })
  minRating?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot be greater than 100' })
  limit?: number;
}

export class TrendingFoodTrucksQueryDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'openOnly must be true or false' })
  openOnly?: boolean;

  @ApiPropertyOptional({ example: 'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66' })
  @IsOptional()
  @IsUUID(undefined, { message: 'cuisineId must be a valid UUID' })
  cuisineId?: string;

  @ApiPropertyOptional({ example: 'mexican-tacos' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'cuisineSlug must be a string' })
  @MaxLength(100, {
    message: 'cuisineSlug cannot be longer than 100 characters',
  })
  cuisineSlug?: string;

  @ApiPropertyOptional({ example: 'Mexican' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'cuisine must be a string' })
  @MaxLength(100, { message: 'cuisine cannot be longer than 100 characters' })
  cuisine?: string;

  @ApiPropertyOptional({ example: 'burger' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search cannot be longer than 100 characters' })
  search?: string;

  @ApiPropertyOptional({ example: 'Downtown' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'area must be a string' })
  @MaxLength(100, { message: 'area cannot be longer than 100 characters' })
  area?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'city must be a string' })
  @MaxLength(100, { message: 'city cannot be longer than 100 characters' })
  city?: string;

  @ApiPropertyOptional({
    example: 4.0,
    description: 'Minimum average rating (e.g. 3.0, 3.5, 4.0, 4.5)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'minRating must be a number' })
  @Min(1, { message: 'minRating must be at least 1' })
  @Max(5, { message: 'minRating cannot be greater than 5' })
  minRating?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot be greater than 100' })
  limit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset must be an integer' })
  @Min(0, { message: 'offset cannot be negative' })
  offset?: number;
}
