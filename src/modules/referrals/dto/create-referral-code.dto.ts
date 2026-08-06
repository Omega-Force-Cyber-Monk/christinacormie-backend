import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReferralCodeDto {
  @ApiProperty({ example: 'CUSTOMER', enum: ['CUSTOMER', 'VENDOR'] })
  @IsIn(['CUSTOMER', 'VENDOR'])
  programType: string;

  @ApiPropertyOptional({ example: 'FRIEND2026' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maximumUses?: number;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
