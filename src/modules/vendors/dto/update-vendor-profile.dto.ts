import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateVendorProfileDto {
  @ApiPropertyOptional({ example: 'Tasty Tacos Gourmet Food Truck' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({ example: 'contact@tastytacos.com' })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ example: '+12025550199' })
  @IsOptional()
  @IsPhoneNumber()
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'Best authentic gourmet street tacos in Austin' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.bitedrop.com/vendors/tasty-tacos-logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'https://tastytacos.example.com' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}
