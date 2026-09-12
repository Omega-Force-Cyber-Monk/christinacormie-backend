import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RequestMediaDto } from './request-media.dto';
import { CommunityPostCategory } from '@prisma/client';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export enum RequestTypeDto {
  EVENT = 'EVENT',
  CATERING = 'CATERING',
  CORPORATE = 'CORPORATE',
  SCHOOL = 'SCHOOL',
  HOA = 'HOA',
  NEIGHBORHOOD = 'NEIGHBORHOOD',
  FOOD_TRUCK_NEAR_ME = 'FOOD_TRUCK_NEAR_ME',
  OTHER = 'OTHER',
}

export enum CommunityEventTypeDto {
  CORPORATE_EVENT = 'CORPORATE_EVENT',
  BIRTHDAY_PARTY = 'BIRTHDAY_PARTY',
  WEDDING_RECEPTION = 'WEDDING_RECEPTION',
  GRADUATION_PARTY = 'GRADUATION_PARTY',
  COMMUNITY_EVENT = 'COMMUNITY_EVENT',
  FUNDRAISER = 'FUNDRAISER',
  OTHER = 'OTHER',
}

export class CreateCommunityRequestDto {
  @ApiPropertyOptional({ enum: CommunityPostCategory, default: 'NEED_TRUCK' })
  @IsOptional()
  @IsEnum(CommunityPostCategory, {
    message:
      'category must be NEED_TRUCK, VENDOR_CALLOUT, FOR_SALE, HIRING_JOBS, COMMUNITY_HELP, or COMMUNITY',
  })
  category?: CommunityPostCategory;

  @ApiPropertyOptional({
    example: 6,
    description: 'Optional structured Vendor Callout field.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  spotsOpen?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attendanceMin?: number;

  @ApiPropertyOptional({ example: 2500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attendanceMax?: number;
  @ApiPropertyOptional({
    enum: RequestTypeDto,
    example: RequestTypeDto.EVENT,
    description:
      'High-level request category. Defaults to EVENT for the need-a-truck flow.',
  })
  @IsOptional()
  @IsEnum(RequestTypeDto)
  requestType?: RequestTypeDto;

  @ApiPropertyOptional({
    enum: CommunityEventTypeDto,
    example: CommunityEventTypeDto.CORPORATE_EVENT,
    description: 'Event type selected from the customer request form.',
  })
  @IsOptional()
  @IsEnum(CommunityEventTypeDto)
  eventType?: CommunityEventTypeDto;

  @ApiPropertyOptional({
    example: 'Corporate Lunch Catering Request',
    description:
      'Optional title. If omitted, the backend generates one from event type and location.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    example: 'Backend walkthrough request for a taco truck lunch service',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: '2026-08-25T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  eventDate?: string;

  @ApiPropertyOptional({ example: '17:00' })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({
    example: '20:00',
    description:
      'Optional event end time. If omitted, quote acceptance reserves three hours after startTime.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(TIME_PATTERN)
  endTime?: string;

  @ApiPropertyOptional({ example: 'America/Chicago' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventTimezone?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guestCount?: number;

  @ApiPropertyOptional({ example: 300.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @ApiPropertyOptional({ example: 800.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @ApiPropertyOptional({ example: '2500 Maple Ave, Austin, TX 78702' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '01612767382' })
  @IsOptional()
  @IsPhoneNumber(undefined)
  contactPhone?: string;

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

  @ApiPropertyOptional({ example: ['Mexican', 'Tacos', 'Desserts'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCuisines?: string[];

  @ApiPropertyOptional({
    example: ['Tacos', 'Caesar Salad Cups'],
    description: 'Preferred menu item tags selected by the customer.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30, { message: 'You can select up to 30 preferred menu items' })
  @MaxLength(150, { each: true })
  preferredMenuItems?: string[];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  allowPublicComments?: boolean;

  @ApiPropertyOptional({ example: '2026-08-24T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @ApiPropertyOptional({ type: [RequestMediaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestMediaDto)
  @ArrayMaxSize(5, {
    message: 'A Community post can contain at most 5 attachments',
  })
  media?: RequestMediaDto[];
}
