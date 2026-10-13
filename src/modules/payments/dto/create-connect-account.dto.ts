import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateConnectAccountDto {
  @ApiPropertyOptional({
    example: 'https://api.bitedropapp.com/api/v1/payments/connect/refresh',
    description:
      'Deprecated for mobile app flow. Backend uses STRIPE_CONNECT_REFRESH_URL for Stripe Connect security.',
  })
  @IsOptional()
  @IsUrl()
  refreshUrl?: string;

  @ApiPropertyOptional({
    example: 'https://api.bitedropapp.com/api/v1/payments/connect/return',
    description:
      'Deprecated for mobile app flow. Backend uses STRIPE_CONNECT_RETURN_URL for Stripe Connect security.',
  })
  @IsOptional()
  @IsUrl()
  returnUrl?: string;

  @ApiPropertyOptional({ example: 'US', default: 'US' })
  @IsOptional()
  @IsString()
  country?: string;
}
