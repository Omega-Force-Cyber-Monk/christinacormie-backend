import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateDraftFoodTruckDto {
  @ApiProperty({ example: 'Tasty Tacos Express' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Authentic gourmet street tacos & fresh salsas' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.bitedrop.com/trucks/tasty-tacos-profile.jpg' })
  @IsOptional()
  @IsUrl()
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.bitedrop.com/trucks/tasty-tacos-cover.jpg' })
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 300.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumBookingAmount?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maximumGuestCapacity?: number;
}
