import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  @IsUUID()
  bookingId: string;

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

  @ApiPropertyOptional({ example: 'Food arrived hot and on time. Everyone loved the tacos and fresh salsas.' })
  @IsOptional()
  @IsString()
  content?: string;
}
