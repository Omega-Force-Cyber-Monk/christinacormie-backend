import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateTruckLocationDto {
  @ApiProperty({ example: 30.2672 })
  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: -97.7431 })
  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: '100 Congress Ave, Austin, TX 78701' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 240, description: 'Duration in minutes location is valid for (e.g. 240 = 4 hours)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  validForMinutes?: number;
}
