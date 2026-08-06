import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingQuoteDto {
  @ApiProperty({ example: 500.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiPropertyOptional({ example: 50.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  outsideRadiusFee?: number;

  @ApiPropertyOptional({ example: 25.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 40.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 20.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 'Includes full menu service and staff setup' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: 'Deposit required within 24 hours of acceptance' })
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional({ example: '2026-08-15T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}
