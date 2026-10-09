import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class BecomeVendorDto {
  @ApiPropertyOptional({ example: 'Taco Paradise' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({ example: 'owner@example.com' })
  @IsOptional()
  @IsEmail()
  businessEmail?: string;

  @ApiPropertyOptional({ example: '+12025550191' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  businessPhone?: string;

  @ApiPropertyOptional({ example: 'Mexican street food truck' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://tacoparadise.example.com' })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({
    example: 'VENDOR2026',
    description:
      'Optional referral code entered when an existing Foodie adds a Vendor profile.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  referralCode?: string;
}
