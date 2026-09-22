import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VendorSubscriptionPlatform } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertProviderProductDto {
  @ApiProperty({ enum: VendorSubscriptionPlatform, example: 'IOS' })
  @IsEnum(VendorSubscriptionPlatform)
  platform!: VendorSubscriptionPlatform;

  @ApiPropertyOptional({ example: 'com.bitedrop.app.vendor.pro.monthly' })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional({ example: 'vendor_subscription' })
  @IsOptional()
  @IsString()
  entitlementId?: string;

  @ApiPropertyOptional({ example: 'default' })
  @IsOptional()
  @IsString()
  revenueCatOfferingId?: string;

  @ApiPropertyOptional({ example: 'pro_monthly' })
  @IsOptional()
  @IsString()
  revenueCatPackageId?: string;

  @ApiPropertyOptional({ example: 'prod_...' })
  @IsOptional()
  @IsString()
  stripeProductId?: string;

  @ApiPropertyOptional({ example: 'price_...' })
  @IsOptional()
  @IsString()
  stripePriceId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
