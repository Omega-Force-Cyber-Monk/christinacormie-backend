import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsPhoneNumber,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum BookingTypeDto {
  QUICK_BOOKING = 'QUICK_BOOKING',
  EVENT = 'EVENT',
  CATERING = 'CATERING',
  PRIVATE_REQUEST = 'PRIVATE_REQUEST',
  COMMUNITY_REQUEST = 'COMMUNITY_REQUEST',
}

export enum BookingEventTypeDto {
  BIRTHDAY_PARTY = 'BIRTHDAY_PARTY',
  CORPORATE_EVENT = 'CORPORATE_EVENT',
  WEDDING = 'WEDDING',
  WEDDING_RECEPTION = 'WEDDING_RECEPTION',
  GRADUATION_PARTY = 'GRADUATION_PARTY',
  COMMUNITY_EVENT = 'COMMUNITY_EVENT',
  FUNDRAISER = 'FUNDRAISER',
  PRIVATE_PARTY = 'PRIVATE_PARTY',
  OTHER = 'OTHER',
}

export enum BookingPaymentPreferenceDto {
  DEPOSIT_ONLY = 'DEPOSIT_ONLY',
  PREPAID_IN_FULL = 'PREPAID_IN_FULL',
  NO_PREFERENCE = 'NO_PREFERENCE',
}

export class CreateBookingDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  foodTruckId: string;

  @ApiPropertyOptional({
    enum: BookingTypeDto,
    example: BookingTypeDto.EVENT,
    description: 'High-level booking category. Defaults to EVENT when omitted.',
  })
  @IsOptional()
  @IsEnum(BookingTypeDto)
  bookingType?: BookingTypeDto;

  @ApiProperty({
    enum: BookingEventTypeDto,
    example: BookingEventTypeDto.CORPORATE_EVENT,
    description:
      'User-facing event subtype from the booking form such as birthday party, corporate event, wedding, or private party.',
  })
  @IsEnum(BookingEventTypeDto)
  eventType: BookingEventTypeDto;

  @ApiPropertyOptional({ example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  communityRequestId?: string;

  @ApiPropertyOptional({ example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  @IsOptional()
  @IsUUID()
  vendorOfferId?: string;

  @ApiPropertyOptional({ example: 'Annual Summer Corporate Party' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  eventName?: string;

  @ApiPropertyOptional({ example: 'Catering service for 50 corporate employees' })
  @IsOptional()
  @IsString()
  eventDescription?: string;

  @ApiProperty({ example: '2026-08-20T18:00:00.000Z' })
  @IsISO8601({ strict: true })
  startsAt: string;

  @ApiProperty({ example: '2026-08-20T21:00:00.000Z' })
  @IsISO8601({ strict: true })
  endsAt: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount: number;

  @ApiProperty({ example: '100 Congress Ave, Austin, TX 78701' })
  @IsString()
  address: string;

  @ApiProperty({ example: '+12025550199' })
  @IsPhoneNumber(undefined)
  contactPhone: string;

  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 800.0, description: 'Optional customer budget for the event' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional({ example: 500.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({
    type: [String],
    example: [
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
    ],
    description: 'Preferred menu item IDs selected by the customer',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  preferredMenuItemIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: [
      'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg',
    ],
    description: 'Optional reference image URLs uploaded before the booking request',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  referenceImageUrls?: string[];

  @ApiPropertyOptional({
    enum: BookingPaymentPreferenceDto,
    example: BookingPaymentPreferenceDto.DEPOSIT_ONLY,
  })
  @IsOptional()
  @IsEnum(BookingPaymentPreferenceDto)
  paymentPreference?: BookingPaymentPreferenceDto;

  @ApiPropertyOptional({ example: 'Please arrive 30 minutes early for setup' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
