import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TruckType, VendorPlan } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OnboardingContactDto {
  @ApiProperty({ example: 'Demo Vendor' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @MaxLength(150)
  city: string;

  @ApiProperty({ example: 'TX' })
  @IsString()
  @MaxLength(150)
  state: string;

  @ApiProperty({ example: 'arifdev257@gmail.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '01402667768' })
  @IsString()
  @MaxLength(30)
  phoneNumber: string;
}

export class OnboardingMenuItemDto {
  @ApiProperty({ example: 'Birria Tacos' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 14.99 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'Slow-cooked beef tacos with consomme' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/birria.jpg',
    description:
      'Cloudinary image URL returned by POST /api/v1/vendors/me/onboarding/upload',
  })
  @IsOptional()
  @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/birria.jpg',
    description:
      'Cloudinary image URL returned by POST /api/v1/vendors/me/onboarding/upload',
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}

export class CompleteVendorOnboardingDto {
  @ApiPropertyOptional({ enum: VendorPlan, example: VendorPlan.FREE })
  @IsOptional()
  @IsEnum(VendorPlan)
  plan?: VendorPlan;

  @ApiPropertyOptional({ enum: VendorPlan, example: VendorPlan.FREE })
  @IsOptional()
  @IsEnum(VendorPlan)
  selectedPlan?: VendorPlan;

  @ApiPropertyOptional({ type: OnboardingContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingContactDto)
  contact?: OnboardingContactDto;

  @ApiPropertyOptional({ example: 'Demo Vendor' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  state?: string;

  @ApiPropertyOptional({ example: 'arifdev257@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'Demo Tacos Express' })
  @IsString()
  @MaxLength(255)
  truckName: string;

  @ApiPropertyOptional({ example: 'Demo Tacos' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  truckCallName?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/logo.jpg',
    description:
      'Cloudinary image URL returned by POST /api/v1/vendors/me/onboarding/upload',
  })
  @IsOptional()
  @IsUrl()
  truckLogoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/logo.jpg',
    description:
      'Cloudinary image URL returned by POST /api/v1/vendors/me/onboarding/upload',
  })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/vendors/onboarding/truck.jpg',
    description:
      'Cloudinary image URL returned by POST /api/v1/vendors/me/onboarding/upload',
  })
  @IsOptional()
  @IsUrl()
  truckImageUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  needsProfessionalPhotos?: boolean;

  @ApiPropertyOptional({ type: OnboardingMenuItemDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingMenuItemDto)
  menuItem?: OnboardingMenuItemDto;

  @ApiPropertyOptional({ type: OnboardingMenuItemDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingMenuItemDto)
  firstMenuItem?: OnboardingMenuItemDto;

  @ApiProperty({ example: 'Mexican' })
  @IsString()
  @MaxLength(100)
  cuisineType: string;

  @ApiProperty({ example: 'Austin' })
  @IsString()
  @MaxLength(150)
  primaryCity: string;

  @ApiProperty({ enum: TruckType, example: TruckType.FOOD_TRUCK })
  @IsEnum(TruckType)
  truckType: TruckType;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  serviceRadiusKm?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  serviceRadius?: number;

  @ApiPropertyOptional({ example: '100 Congress Ave, Austin, TX 78701' })
  @IsOptional()
  @IsString()
  serviceAddress?: string;

  @ApiPropertyOptional({ example: 30.2672 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -97.7431 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
