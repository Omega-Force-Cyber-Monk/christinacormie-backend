import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum LeaderboardTypeDto {
  TOP_RATED = 'TOP_RATED',
  MOST_BOOKED = 'MOST_BOOKED',
  MOST_VISITED = 'MOST_VISITED',
  MOST_LIKED = 'MOST_LIKED',
  MOST_ENGAGED = 'MOST_ENGAGED',
  TRENDING = 'TRENDING',
  RISING = 'RISING',
  NEW_TRUCKS = 'NEW_TRUCKS',
  OVERALL = 'OVERALL',
}

export enum LeaderboardPeriodDto {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ALL_TIME = 'ALL_TIME',
}

export class UpsertLeaderboardRuleDto {
  @ApiProperty({ enum: LeaderboardTypeDto, example: LeaderboardTypeDto.TOP_RATED })
  @IsEnum(LeaderboardTypeDto)
  type: LeaderboardTypeDto;

  @ApiProperty({ enum: LeaderboardPeriodDto, example: LeaderboardPeriodDto.MONTHLY })
  @IsEnum(LeaderboardPeriodDto)
  period: LeaderboardPeriodDto;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bookingWeight?: number;

  @ApiPropertyOptional({ example: 2.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ratingWeight?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reliabilityWeight?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  engagementWeight?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  checkInWeight?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumCompletedBookings?: number;

  @ApiProperty({ example: 'v1.0' })
  @IsString()
  @MaxLength(30)
  algorithmVersion: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
