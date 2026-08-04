import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CommentPostDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}
