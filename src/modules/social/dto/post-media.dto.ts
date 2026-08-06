import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class PostMediaDto {
  @ApiProperty({ example: 'IMAGE' })
  @IsString()
  @MaxLength(20)
  mediaType: string;

  @ApiProperty({ example: 'https://cdn.bitedrop.com/posts/taco-special.jpg' })
  @IsUrl()
  mediaUrl: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
