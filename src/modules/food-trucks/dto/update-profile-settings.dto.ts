import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CuisineSelectionDto } from './set-cuisines.dto';
import { OperatingHourDto } from './set-operating-hours.dto';

class ProfileServiceAreaDto {
  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'San Francisco, CA' })
  @IsOptional()
  @IsString()
  centerAddress?: string;

  @ApiPropertyOptional({ example: 37.7749 })
  @IsLatitude()
  latitude: number;

  @ApiPropertyOptional({ example: -122.4194 })
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 25 })
  @IsNumber()
  @Min(0.1)
  radiusKm: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  outsideRadiusAllowed?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  outsideRadiusFee?: number;
}

export class UpdateFoodTruckProfileSettingsDto {
  @ApiPropertyOptional({ example: 'Fuego Tacos 🔥' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'fuegotacos',
    description:
      'Public @handle without @. Lowercase letters, numbers, dots, underscores, and hyphens are allowed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'handle can only contain letters, numbers, dots, underscores, and hyphens',
  })
  handle?: string;

  @ApiPropertyOptional({ example: 'Mexican street food' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.bitedrop.com/trucks/fuego-profile.jpg',
  })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.bitedrop.com/trucks/fuego-cover.jpg',
  })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maximumGuestCapacity?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBookingAmount?: number;

  @ApiPropertyOptional({ type: [OperatingHourDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDto)
  operatingHours?: OperatingHourDto[];

  @ApiPropertyOptional({ type: [CuisineSelectionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuisineSelectionDto)
  cuisines?: CuisineSelectionDto[];

  @ApiPropertyOptional({ type: ProfileServiceAreaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileServiceAreaDto)
  serviceArea?: ProfileServiceAreaDto;
}
