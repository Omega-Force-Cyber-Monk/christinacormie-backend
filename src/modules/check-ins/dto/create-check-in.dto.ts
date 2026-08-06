import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCheckInDto {
  @ApiPropertyOptional({ example: 'd3eebc99-9c0b-4ef8-bb6d-6bb9bd380a44' })
  @IsOptional()
  @IsUUID()
  qrScanId?: string;

  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  locationAccuracyMeters?: number;

  @ApiPropertyOptional({ example: 'device_iphone14_xyz' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
