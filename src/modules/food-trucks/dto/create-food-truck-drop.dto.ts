import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFoodTruckDropDto {
  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: 'Flash Pop-Up Drop at Downtown Plaza' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'Serving hot tacos for the next 2 hours! Free chips with any order.' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ example: '600 Congress Ave, Austin, TX 78701' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 120, default: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;
}
