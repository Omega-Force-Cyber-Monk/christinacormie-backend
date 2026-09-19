import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateReviewDto {
  @ApiPropertyOptional({
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    description:
      'Completed booking id. Provide either bookingId or redemptionId, not both.',
  })
  @ValidateIf((dto: CreateReviewDto) => !dto.redemptionId)
  @IsUUID()
  bookingId?: string;

  @ApiPropertyOptional({
    example: '32fbf1d1-e474-4f91-b690-2da2f182c5a3',
    description:
      'Confirmed BiteDrop credit redemption id. Provide either bookingId or redemptionId, not both.',
  })
  @ValidateIf((dto: CreateReviewDto) => !dto.bookingId)
  @IsUUID()
  redemptionId?: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({ example: 'Amazing Tacos and Outstanding Service!' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    example:
      'Food arrived hot and on time. Everyone loved the tacos and fresh salsas.',
  })
  @IsOptional()
  @IsString()
  content?: string;
}
