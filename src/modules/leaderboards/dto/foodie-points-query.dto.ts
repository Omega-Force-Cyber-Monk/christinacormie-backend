import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class FoodiePointsQueryDto {
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

export class FoodiePointsEntryDto {
  @ApiProperty({ example: 1 })
  rank: number;

  @ApiProperty({ example: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b' })
  userId: string;

  @ApiProperty({ example: 'Alex Rivera' })
  displayName: string;

  @ApiProperty({
    example: 'https://cdn.bitedrop.com/users/alex.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    example: 1780,
    description: 'Lifetime loyalty points earned by the Foodie.',
  })
  points: number;
}

export class FoodiePointsLeaderboardResponseDto {
  @ApiProperty({ type: [FoodiePointsEntryDto] })
  items: FoodiePointsEntryDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 20, nullable: true })
  nextOffset: number | null;
}
