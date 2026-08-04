import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  distanceUnit?: string;

  @IsOptional()
  @IsBoolean()
  locationPermissionGranted?: boolean;

  @IsOptional()
  @IsBoolean()
  pushPermissionGranted?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;
}
