import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBadgeDto {
  @ApiProperty({ example: 'Super Foodie' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'super-foodie' })
  @IsString()
  @MaxLength(150)
  slug: string;

  @ApiPropertyOptional({ example: 'Awarded for checking in at 10 different food trucks' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.bitedrop.com/badges/super-foodie.png' })
  @IsOptional()
  @IsString()
  iconUrl?: string;

  @ApiProperty({ example: 'CUSTOMER', enum: ['CUSTOMER', 'VENDOR', 'BOTH'] })
  @IsIn(['CUSTOMER', 'VENDOR', 'BOTH'])
  ownerType: string;

  @ApiPropertyOptional({ example: '#FFD700' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  glowColor?: string;

  @ApiPropertyOptional({ example: { minCheckIns: 10 } })
  @IsOptional()
  @IsObject()
  criteria?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
