import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateVendorFoundingOfferDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: '2026-08-05T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional({ example: '2026-10-04T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({ example: '2026-10-05T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  officialLaunchAt?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  subscriptionDiscountPercent?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  subscriptionDiscountMonths?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  freeTrialMonths?: number;
}

