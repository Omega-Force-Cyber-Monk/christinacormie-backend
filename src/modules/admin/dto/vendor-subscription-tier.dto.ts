import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { VendorPlan } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateVendorSubscriptionTierDto {
  @ApiProperty({ example: 'STARTER' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ enum: VendorPlan, example: VendorPlan.STARTER })
  @IsOptional()
  @IsEnum(VendorPlan)
  legacyPlan?: VendorPlan;

  @ApiProperty({ example: 'Starter' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Drops & Bookings' })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiPropertyOptional({ example: 'MOST POPULAR' })
  @IsOptional()
  @IsString()
  badge?: string;

  @ApiProperty({ example: 1000, description: 'Monthly price in cents' })
  @IsInt()
  @Min(0)
  monthlyPriceCents: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  foundingMonthlyPriceCentsAfterTrial?: number;

  @ApiPropertyOptional({ example: 0.15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  normalCommissionRate?: number;

  @ApiPropertyOptional({ example: 0.12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  foundingCommissionRate?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  bookingEnabled?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxStaffAccounts?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxIncludedTrucks?: number;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  additionalTruckMonthlyPriceCents?: number;

  @ApiPropertyOptional({ example: 'BASIC' })
  @IsOptional()
  @IsString()
  analyticsLevel?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: { eventBookings: true, staffAccounts: 1 } })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: ['Everything in Free', 'Event booking requests'],
  })
  @IsOptional()
  included?: unknown;

  @ApiPropertyOptional({ example: ['Advanced analytics'] })
  @IsOptional()
  notIncluded?: unknown;
}

export class UpdateVendorSubscriptionTierDto extends PartialType(
  CreateVendorSubscriptionTierDto,
) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
