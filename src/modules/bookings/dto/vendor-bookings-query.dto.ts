import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export enum VendorBookingTabDto {
  REQUESTS = 'REQUESTS',
  ORDERS = 'ORDERS',
  ALL = 'ALL',
}

export enum VendorBookingSourceDto {
  DIRECT = 'DIRECT',
  COMMUNITY = 'COMMUNITY',
  ALL = 'ALL',
}

export class VendorBookingsQueryDto {
  @ApiPropertyOptional({
    enum: VendorBookingTabDto,
    description:
      'Filter bookings by screen tab. REQUESTS returns PENDING and QUOTED bookings. ORDERS returns active, confirmed, and completed orders.',
    example: VendorBookingTabDto.REQUESTS,
  })
  @IsOptional()
  @IsEnum(VendorBookingTabDto)
  tab?: VendorBookingTabDto;

  @ApiPropertyOptional({
    enum: VendorBookingSourceDto,
    description:
      'Filter by origin: DIRECT (direct profile booking request) or COMMUNITY (community-originated booking). Defaults to ALL.',
    example: VendorBookingSourceDto.DIRECT,
  })
  @IsOptional()
  @IsEnum(VendorBookingSourceDto)
  source?: VendorBookingSourceDto;

  @ApiPropertyOptional({
    description:
      'Filter by specific booking status or comma-separated statuses (e.g. PENDING,QUOTED).',
    example: 'PENDING',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter bookings by food truck ID.',
    example: '50963aa2-715a-429e-a3b9-40a1d012cce9',
  })
  @IsOptional()
  @IsUUID()
  foodTruckId?: string;
}
