import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class PostMediaDto {
  @IsString()
  @MaxLength(20)
  mediaType: string;

  @IsUrl()
  mediaUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
