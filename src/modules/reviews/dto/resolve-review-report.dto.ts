import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReportStatusDto {
  REVIEWING = 'REVIEWING',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

export class ResolveReviewReportDto {
  @ApiProperty({ enum: ReportStatusDto, example: ReportStatusDto.RESOLVED })
  @IsEnum(ReportStatusDto)
  status: ReportStatusDto;

  @ApiPropertyOptional({ example: 'Review moderated and hidden due to policy violation.' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
