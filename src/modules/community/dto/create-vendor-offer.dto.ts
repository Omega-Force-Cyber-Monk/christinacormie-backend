import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateVendorOfferDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  foodTruckId: string;

  @ApiPropertyOptional({ example: 'We can cater your event with full menu options for 75 guests!' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ example: 600.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quotedAmount: number;

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: '2026-08-22T23:59:59.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;
}
