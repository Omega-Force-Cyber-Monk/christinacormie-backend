import { ApiPropertyOptional } from '@nestjs/swagger';
import { VendorPlan } from '@prisma/client';
import {
  IsArray,
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

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ enum: VendorPlan })
  @IsOptional()
  @IsEnum(VendorPlan)
  code?: VendorPlan;

  @ApiPropertyOptional({ example: 'Pro' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Full platform access with analytics.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 19 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @ApiPropertyOptional({ example: 0.12 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  standardCommissionRate?: number;

  @ApiPropertyOptional({ example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  foundingCommissionRate?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: ['bookings', 'analytics'] })
  @IsOptional()
  @IsArray()
  features?: string[];

  @ApiPropertyOptional({
    example: { staffAccounts: 2, truckListings: 1, bookings: true },
  })
  @IsOptional()
  @IsObject()
  limits?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
