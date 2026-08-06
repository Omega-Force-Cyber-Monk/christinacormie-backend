import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum PromotionTypeDto {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  FREE_ITEM = 'FREE_ITEM',
  CUSTOM = 'CUSTOM',
}

export class CreatePromotionDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  foodTruckId: string;

  @ApiProperty({ example: '20% OFF Summer Special' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Get 20% off your entire order when you spend $25 or more!' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromotionTypeDto, example: PromotionTypeDto.PERCENTAGE })
  @IsEnum(PromotionTypeDto)
  type: PromotionTypeDto;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value?: number;

  @ApiPropertyOptional({ example: 'SUMMER20' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  couponCode?: string;

  @ApiPropertyOptional({ example: 25.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumSpend?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFollowerOnly?: boolean;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2026-08-31T23:59:59.000Z' })
  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
