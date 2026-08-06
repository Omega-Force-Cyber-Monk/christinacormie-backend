import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBookingPaymentDto {
  @ApiProperty({ example: 'idemp_key_booking_12345' })
  @IsString()
  @MaxLength(255)
  idempotencyKey: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;
}
