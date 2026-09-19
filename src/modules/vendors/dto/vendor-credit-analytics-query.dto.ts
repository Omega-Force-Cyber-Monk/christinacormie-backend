import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class VendorCreditAnalyticsQueryDto {
  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description:
      'Optional food truck filter. If omitted, analytics aggregate all active vendor food trucks.',
  })
  @IsOptional()
  @IsUUID()
  foodTruckId?: string;

  @ApiPropertyOptional({
    example: 'week',
    default: 'week',
    enum: ['week', 'month'],
  })
  @IsOptional()
  @IsIn(['week', 'month'])
  range?: 'week' | 'month';

  @ApiPropertyOptional({
    example: 'America/Chicago',
    default: 'UTC',
    description:
      'IANA timezone used by the frontend. Current backend aggregation is UTC-safe and accepts this for API compatibility.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
