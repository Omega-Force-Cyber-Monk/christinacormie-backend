import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum SocialAccountType {
  ALL = 'ALL',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
}

export class ProfileSocialQueryDto {
  @ApiPropertyOptional({
    enum: SocialAccountType,
    default: SocialAccountType.ALL,
  })
  @IsOptional()
  @IsEnum(SocialAccountType)
  type?: SocialAccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
