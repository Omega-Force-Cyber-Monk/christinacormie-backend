import { ApiPropertyOptional } from '@nestjs/swagger';
import { PhotoShootRequestStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePhotoShootRequestDto {
  @ApiPropertyOptional({ enum: PhotoShootRequestStatus })
  @IsOptional()
  @IsEnum(PhotoShootRequestStatus)
  status?: PhotoShootRequestStatus;

  @ApiPropertyOptional({ example: 'Vendor contacted and shoot scheduled.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
