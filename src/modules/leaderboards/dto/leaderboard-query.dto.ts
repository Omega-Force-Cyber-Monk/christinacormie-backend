import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { LeaderboardPeriodDto } from '../../admin/dto/upsert-leaderboard-rule.dto';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ example: 'm1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77' })
  @IsOptional()
  @IsUUID()
  marketId?: string;

  @ApiPropertyOptional({ enum: LeaderboardPeriodDto, example: LeaderboardPeriodDto.MONTHLY })
  @IsOptional()
  @IsEnum(LeaderboardPeriodDto)
  period?: LeaderboardPeriodDto;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
