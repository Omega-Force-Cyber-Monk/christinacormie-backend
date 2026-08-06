import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportReviewDto {
  @ApiProperty({ example: 'INAPPROPRIATE_LANGUAGE' })
  @IsString()
  @MaxLength(255)
  reason: string;

  @ApiPropertyOptional({ example: 'Review contains offensive remarks that violate community guidelines.' })
  @IsOptional()
  @IsString()
  description?: string;
}
