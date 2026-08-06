import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CommentRequestDto {
  @ApiProperty({ example: 'We would love to bring our taco truck to your neighborhood party!' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'e4eebc99-9c0b-4ef8-bb6d-6bb9bd380a55' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
