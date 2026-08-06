import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
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

export class CreateBookingDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  foodTruckId: string;

  @ApiProperty({ enum: BookingTypeDto, example: BookingTypeDto.CATERING })
  @IsEnum(BookingTypeDto)
  bookingType: BookingTypeDto;

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

  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 500.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ example: 'Please arrive 30 minutes early for setup' })
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
