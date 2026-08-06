import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CommentPostDto {
  @ApiProperty({ example: 'Looks delicious! Will definitely visit today.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
