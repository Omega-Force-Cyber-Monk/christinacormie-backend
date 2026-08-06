import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class VendorBookingDecisionDto {
  @ApiPropertyOptional({ example: 'Confirmed availability for requested date and time slot' })
  @IsOptional()
  @IsString()
  reason?: string;
}
