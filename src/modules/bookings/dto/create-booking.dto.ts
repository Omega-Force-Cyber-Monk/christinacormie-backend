import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
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
  Matches,
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

  @ApiPropertyOptional({
    example: 'Catering service for 50 corporate employees',
  })
  @IsOptional()
  @IsString()
  eventDescription?: string;

  @ApiPropertyOptional({
    example: '2026-08-25',
    description:
      'UI-friendly event date. Required with eventTime when startsAt/endsAt are not provided.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate must use YYYY-MM-DD format',
  })
  eventDate?: string;

  @ApiPropertyOptional({
    example: '18:00',
    description:
      'UI-friendly event start time in 24-hour HH:mm format. Required with eventDate when startsAt/endsAt are not provided.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'eventTime must use HH:mm 24-hour format',
  })
  eventTime?: string;

  @ApiPropertyOptional({
    example: '21:00',
    description:
      'Optional UI-friendly event end time in 24-hour HH:mm format. If omitted, backend reserves a 3-hour window.',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must use HH:mm 24-hour format',
  })
  endTime?: string;

  @ApiPropertyOptional({
    example: 'America/Chicago',
    description:
      'IANA time zone used to convert eventDate/eventTime into UTC. Defaults to UTC when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  eventTimezone?: string;

  @ApiPropertyOptional({
    example: '2026-08-20T18:00:00.000Z',
    description:
      'Legacy ISO start datetime. If provided, endsAt must also be provided.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-08-20T21:00:00.000Z',
    description:
      'Legacy ISO end datetime. If provided, startsAt must also be provided.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  endsAt?: string;

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

  @ApiPropertyOptional({
    example: 800.0,
    description: 'Optional customer budget for the event',
  })
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
    example: ['Extra spicy chicken tacos', 'Vegetarian platter'],
    description:
      'Custom menu requests typed by the customer when the item is not available in the truck menu.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, {
    message: 'customMenuItems cannot contain more than 20 items',
  })
  @IsString({ each: true, message: 'Each custom menu item must be text' })
  @MaxLength(150, {
    each: true,
    message: 'Each custom menu item cannot be longer than 150 characters',
  })
  customMenuItems?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: [
      'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/bookings/reference-1.jpg',
    ],
    description:
      'Optional reference image URLs uploaded before the booking request',
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

  @ApiProperty({
    example: true,
    description:
      'Customer must confirm they are 18 years or older before submitting a booking request.',
  })
  @Equals(true, {
    message: 'You must confirm that you are 18 years or older',
  })
  isAdultConfirmed: boolean;

  @ApiProperty({
    example: true,
    description:
      'Customer must accept BiteDrop Terms and Conditions before submitting a booking request.',
  })
  @Equals(true, {
    message: 'You must agree to the BiteDrop Terms and Conditions',
  })
  termsAccepted: boolean;
}
