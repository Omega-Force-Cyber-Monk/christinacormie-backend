import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class NewFoodTruckLeadDto {
  @ApiProperty({ example: 'Spicy Burger Express' })
  @IsString()
  @MaxLength(255)
  truckName: string;

  @ApiPropertyOptional({ example: 'Mike Johnson' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerName?: string;

  @ApiPropertyOptional({ example: 'mike@spicyburger.com' })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({ example: '+15125550188' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerPhone?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/spicyburgerexpress' })
  @IsOptional()
  @IsUrl()
  socialUrl?: string;

  @ApiPropertyOptional({ example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  state?: string;

  @ApiPropertyOptional({ example: 'Spotted at Downtown Food Park, great burgers!' })
  @IsOptional()
  @IsString()
  notes?: string;
}
