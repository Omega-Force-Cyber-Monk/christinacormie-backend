import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID()
  foodTruckId: string;

  @ApiProperty({ example: 'Fresh tacos ready at Downtown Plaza! Come visit us today for 20% off all combos.' })
  @IsString()
  content: string;

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
