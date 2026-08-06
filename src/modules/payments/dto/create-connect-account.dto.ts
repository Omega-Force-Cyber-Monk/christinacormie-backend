import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateConnectAccountDto {
  @ApiPropertyOptional({ example: 'https://bitedrop.com/vendor/onboarding/refresh' })
  @IsOptional()
  @IsUrl()
  refreshUrl?: string;

  @ApiPropertyOptional({ example: 'https://bitedrop.com/vendor/onboarding/return' })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'US', default: 'US' })
  @IsOptional()
  @IsString()
  country?: string;
}
