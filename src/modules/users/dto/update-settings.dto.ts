import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ example: 'America/New_York' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ example: 'MILES' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  distanceUnit?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  locationPermissionGranted?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pushPermissionGranted?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
