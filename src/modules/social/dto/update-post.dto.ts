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
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PostStatusDto)
  status?: PostStatusDto;

  @IsOptional()
  @IsBoolean()
  isPromotion?: boolean;

  @IsOptional()
  @IsBoolean()
  isFollowerOnly?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostMediaDto)
  media?: PostMediaDto[];
}
