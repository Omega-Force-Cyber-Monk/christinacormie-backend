import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateGuestCapacityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maximumGuestCapacity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBookingAmount?: number;
}
