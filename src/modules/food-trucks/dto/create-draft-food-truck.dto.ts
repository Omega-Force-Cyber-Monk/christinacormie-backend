import { IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateDraftFoodTruckDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBookingAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maximumGuestCapacity?: number;
}
