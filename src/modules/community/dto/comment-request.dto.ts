import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CommentRequestDto {
  @ApiProperty({
    example:
      'We would love to bring our taco truck to your neighborhood party!',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'Comment cannot be empty' })
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ example: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
