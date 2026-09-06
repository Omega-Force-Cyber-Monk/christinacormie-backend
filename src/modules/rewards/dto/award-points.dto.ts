import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class AwardPointsDto {
  @ApiProperty({ example: 'u0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'MANUAL_BONUS' })
  @IsString()
  @MaxLength(100)
  sourceType: string;

  @ApiProperty({ example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsUUID()
  sourceId: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  points?: number;

  @ApiPropertyOptional({ example: 'idemp_award_pts_123' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;

  @ApiPropertyOptional({ example: 'Customer appreciation bonus points' })
  @IsOptional()
  @IsString()
  description?: string;
}
