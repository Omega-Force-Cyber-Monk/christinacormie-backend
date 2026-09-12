import { ApiPropertyOptional, PartialType, ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { CommunityPostCategory } from '@prisma/client';
import { CreateCommunityRequestDto } from './create-community-request.dto';

export class UpdateCommunityPostDto extends PartialType(
  CreateCommunityRequestDto,
) {}

export class CommunityPostQueryDto {
  @ApiPropertyOptional({ enum: CommunityPostCategory })
  @IsOptional()
  @IsEnum(CommunityPostCategory)
  category?: CommunityPostCategory;

  @ApiPropertyOptional({
    enum: ['ALL', 'MINE', 'REQUESTS'],
    default: 'ALL',
    description:
      'REQUESTS lists open public Need-a-Truck and Callout opportunities from other users.',
  })
  @IsOptional()
  @IsEnum({ ALL: 'ALL', MINE: 'MINE', REQUESTS: 'REQUESTS' })
  tab?: 'ALL' | 'MINE' | 'REQUESTS';

  @ApiPropertyOptional({ example: 37.7749 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -122.4194 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ default: 40, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  radiusKm?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset?: number;
}

export class CommunityInterestDto {
  @ApiProperty({
    example: 'We serve fresh tacos and would love to join your event.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({
    message: 'Please enter an introduction before sending interest',
  })
  @MaxLength(2000)
  message: string;
}
