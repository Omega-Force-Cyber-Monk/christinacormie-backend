import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum AdminCommunityRequestStatusDto {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  MATCHED = 'MATCHED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class ModerateCommunityRequestDto {
  @ApiPropertyOptional({ enum: AdminCommunityRequestStatusDto, example: AdminCommunityRequestStatusDto.CLOSED })
  @IsOptional()
  @IsEnum(AdminCommunityRequestStatusDto)
  status?: AdminCommunityRequestStatusDto;

  @ApiPropertyOptional({ example: '2026-08-06T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  deletedAt?: string;
}
