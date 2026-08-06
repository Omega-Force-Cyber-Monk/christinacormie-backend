import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRewardRuleDto {
  @ApiProperty({ example: '$10 Off Next Order' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Redeem 500 loyalty points for a $10 discount coupon' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'LOYALTY_POINTS' })
  @IsString()
  @MaxLength(50)
  triggerType: string;

  @ApiProperty({ example: 'DISCOUNT', enum: ['POINTS', 'CREDIT', 'DISCOUNT', 'FREE_ITEM', 'COMMISSION_REDUCTION', 'FEATURED_PLACEMENT', 'CUSTOM'] })
  @IsIn([
    'POINTS',
    'CREDIT',
    'DISCOUNT',
    'FREE_ITEM',
    'COMMISSION_REDUCTION',
    'FEATURED_PLACEMENT',
    'CUSTOM',
  ])
  rewardType: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pointsRequired?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rewardValue?: number;

  @ApiPropertyOptional({ example: { discountType: 'FIXED_AMOUNT', amount: 10 } })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumUsesPerUser?: number;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
