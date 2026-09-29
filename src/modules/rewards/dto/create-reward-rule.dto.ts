import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRewardRuleDto {
  @ApiProperty({ example: '$10 Off Next Order' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'Redeem 500 loyalty points for a $10 discount coupon',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'LOYALTY_POINTS' })
  @IsString()
  @MaxLength(50)
  triggerType: string;

  @ApiProperty({
    example: 'DISCOUNT',
    enum: [
      'POINTS',
      'CREDIT',
      'DISCOUNT',
      'FREE_ITEM',
      'COMMISSION_REDUCTION',
      'FEATURED_PLACEMENT',
      'CUSTOM',
    ],
  })
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

  @ApiPropertyOptional({
    example: 'VENDOR_FUNDED',
    enum: ['VENDOR_FUNDED', 'BITEDROP_FUNDED'],
    default: 'VENDOR_FUNDED',
    description:
      'Who funds this reward. Standard rewards default to vendor-funded.',
  })
  @IsOptional()
  @IsIn(['VENDOR_FUNDED', 'BITEDROP_FUNDED'])
  fundingType?: 'VENDOR_FUNDED' | 'BITEDROP_FUNDED';

  @ApiPropertyOptional({
    example: 15.0,
    description:
      'Minimum customer order amount required to use this reward. Backend stores/displays this value; vendor verifies subtotal in their POS/register.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumPurchaseAmount?: number;

  @ApiPropertyOptional({
    example: 'ALL_APPROVED_VENDORS',
    enum: ['ALL_APPROVED_VENDORS', 'SELECTED_VENDORS'],
    default: 'ALL_APPROVED_VENDORS',
    description:
      'Controls whether all approved vendors or only selected vendors can confirm this reward.',
  })
  @IsOptional()
  @IsIn(['ALL_APPROVED_VENDORS', 'SELECTED_VENDORS'])
  eligibleVendorScope?: 'ALL_APPROVED_VENDORS' | 'SELECTED_VENDORS';

  @ApiPropertyOptional({
    example: [
      '0d6a0fcb-4675-4eb0-9ea2-b035f991e84d',
      '9b933667-af6b-4b4b-a441-f2ca47d3a711',
    ],
    description:
      'Required when eligibleVendorScope is SELECTED_VENDORS. Vendor IDs that can confirm this reward.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  eligibleVendorIds?: string[];

  @ApiPropertyOptional({
    example: { discountType: 'FIXED_AMOUNT', amount: 10 },
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumUsesPerUser?: number;

  @ApiPropertyOptional({
    example: 500,
    description:
      'Maximum total successful/active redemptions allowed for this reward campaign. Empty means unlimited.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalRedemptionLimit?: number;

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
