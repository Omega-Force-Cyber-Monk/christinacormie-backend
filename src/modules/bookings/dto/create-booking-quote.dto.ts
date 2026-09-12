import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { BookingPaymentPreferenceDto } from './create-booking.dto';
import {
  OfferExtraChargeDto,
  OfferPricingModelDto,
} from '../../community/dto/create-vendor-offer.dto';

export class CreateBookingQuoteDto {
  @ApiPropertyOptional({
    example: 25,
    description:
      'Required for PER_PERSON; backend multiplies by booking guest count.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  pricePerPerson?: number;
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

  @ApiPropertyOptional({ example: 1200.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outsideRadiusFee?: number;

  @ApiPropertyOptional({ example: 0.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 0.0 })
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

  @ApiPropertyOptional({ example: 1250.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({ example: 1010.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  balanceDueAtEvent?: number;

  @ApiPropertyOptional({
    example: 'Includes full menu service and staff setup',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    example: 'Please ensure level parking space for the food truck',
  })
  @IsOptional()
  @IsString()
  noteToClient?: string;

  @ApiPropertyOptional({
    example: 'Deposit required within 24 hours of acceptance',
  })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ example: '2026-08-25T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}
