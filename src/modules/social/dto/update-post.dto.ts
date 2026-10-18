import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PostStatusDto } from './create-post.dto';
import { PostMediaDto } from './post-media.dto';

export class UpdatePostDto {
  @ApiPropertyOptional({
    example: 'Updated post content with new taco specials!',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2200)
  content?: string;

  @ApiPropertyOptional({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  taggedUserIds?: string[];

  @ApiPropertyOptional({
    enum: PostStatusDto,
    example: PostStatusDto.PUBLISHED,
  })
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
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  media?: PostMediaDto[];
}
