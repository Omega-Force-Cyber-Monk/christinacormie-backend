import { IsInt, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';

export class AddTruckImageDto {
  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
