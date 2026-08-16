import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingPaymentDto {
  @ApiProperty({ example: 'booking-{{bookingId}}-deposit-1' })
  @IsString()
  @MaxLength(255)
  idempotencyKey: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
