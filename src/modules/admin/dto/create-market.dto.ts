import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum MarketStatusDto {
  PLANNED = 'PLANNED',
  PILOT = 'PILOT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
}

export class CreateMarketDto {
  @ApiProperty({ example: 'Austin Metro' })
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

  @ApiPropertyOptional({ example: 'USA', default: 'USA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ example: 'America/Chicago' })
  @IsString()
  @MaxLength(100)
  timezone: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  operatingRadiusKm?: number;

  @ApiPropertyOptional({ enum: MarketStatusDto, example: MarketStatusDto.ACTIVE })
  @IsOptional()
  @IsEnum(MarketStatusDto)
  status?: MarketStatusDto;
}
