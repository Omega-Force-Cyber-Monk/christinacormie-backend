import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertPlatformSettingDto {
  @ApiProperty({ example: { serviceFeePercent: 5.5, maxBookingDays: 30 } })
  @IsObject()
  value: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Platform fee configuration settings' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
