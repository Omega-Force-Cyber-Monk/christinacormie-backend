import { IsBoolean, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SetupServiceAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  centerAddress?: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsNumber()
  @Min(0.1)
  radiusKm: number;

  @IsOptional()
  @IsBoolean()
  outsideRadiusAllowed?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outsideRadiusFee?: number;
}
