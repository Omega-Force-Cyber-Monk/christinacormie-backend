import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingPaymentPreferenceDto } from '../../bookings/dto/create-booking.dto';

export enum OfferPricingModelDto {
  FLAT_FEE = 'FLAT_FEE',
  PER_PERSON = 'PER_PERSON',
}

export class OfferExtraChargeDto {
  @ApiProperty({ example: 'Transport / Travel' })
  @IsString()
  label: string;

  @ApiProperty({ example: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}

export class CreateVendorOfferDto {
  @ApiProperty({ example: '{{foodTruckId}}' })
  @IsUUID()
  foodTruckId: string;

  @ApiPropertyOptional({ example: 'Quote for full catering service' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: 'Menu includes setup and serving station.' })
  @IsOptional()
  @IsString()
  noteToClient?: string;

  @ApiPropertyOptional({
    enum: OfferPricingModelDto,
    example: OfferPricingModelDto.FLAT_FEE,
  })
  @IsOptional()
  @IsEnum(OfferPricingModelDto)
  pricingModel?: OfferPricingModelDto;

  @ApiPropertyOptional({
    type: [String],
    example: ['Burger', 'Caesar Salad Cups', 'Garlic Breadsticks'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedMenuItems?: string[];

  @ApiPropertyOptional({ example: 1200.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseServiceFee?: number;

  @ApiPropertyOptional({ example: 50.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  transportFee?: number;

  @ApiPropertyOptional({
    type: [OfferExtraChargeDto],
    description: 'Additional charge lines shown in the quote breakdown.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferExtraChargeDto)
  extraCharges?: OfferExtraChargeDto[];

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    enum: BookingPaymentPreferenceDto,
    example: BookingPaymentPreferenceDto.DEPOSIT_ONLY,
  })
  @IsOptional()
  @IsEnum(BookingPaymentPreferenceDto)
  paymentPreference?: BookingPaymentPreferenceDto;

  @ApiPropertyOptional({ example: 240.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: 20.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depositPercent?: number;

  @ApiPropertyOptional({
    example: 1280.0,
    description: 'Total contract amount for the quote. If omitted, the backend derives it from the quote breakdown.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quotedAmount?: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 1040.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balanceDueAtEvent?: number;

  @ApiPropertyOptional({ example: '2026-08-25T16:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}
