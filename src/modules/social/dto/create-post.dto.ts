import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PostMediaDto } from './post-media.dto';

export enum PostStatusDto {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

export class CreatePostDto {
  @IsUUID()
  foodTruckId: string;

  @IsString()
  content: string;

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
