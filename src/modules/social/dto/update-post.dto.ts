import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PostStatusDto } from './create-post.dto';
import { PostMediaDto } from './post-media.dto';

export class UpdatePostDto {
  @ApiPropertyOptional({ example: 'Updated post content with new taco specials!' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: PostStatusDto, example: PostStatusDto.PUBLISHED })
  @IsOptional()
  @IsEnum(PostStatusDto)
  status?: PostStatusDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPromotion?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isFollowerOnly?: boolean;

  @ApiPropertyOptional({ type: [PostMediaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  media?: PostMediaDto[];
}
