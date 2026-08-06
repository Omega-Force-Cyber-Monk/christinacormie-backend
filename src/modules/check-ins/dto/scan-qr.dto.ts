import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ScanQrDto {
  @ApiPropertyOptional({ example: 'anon_sess_abc123xyz' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  anonymousSessionId?: string;

  @ApiPropertyOptional({ example: 30.2672 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -97.7431 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  openedProfile?: boolean;
}
