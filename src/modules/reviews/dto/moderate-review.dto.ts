import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewStatusDto {
  PUBLISHED = 'PUBLISHED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  HIDDEN = 'HIDDEN',
  REMOVED = 'REMOVED',
}

export class ModerateReviewDto {
  @ApiPropertyOptional({ enum: ReviewStatusDto, example: ReviewStatusDto.HIDDEN })
  @IsOptional()
  @IsEnum(ReviewStatusDto)
  status?: ReviewStatusDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  contentHidden?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ratingVisible?: boolean;

  @ApiPropertyOptional({ example: 'Inappropriate language in review content' })
  @IsOptional()
  @IsString()
  moderationReason?: string;
}
