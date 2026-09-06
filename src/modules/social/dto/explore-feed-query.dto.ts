import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ExploreSortBy {
  NEWEST = 'newest',
  TRENDING = 'trending',
}

export class ExploreFeedQueryDto {
  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'p1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ enum: ExploreSortBy, default: ExploreSortBy.NEWEST })
  @IsOptional()
  @IsEnum(ExploreSortBy)
  sortBy?: ExploreSortBy = ExploreSortBy.NEWEST;
}
