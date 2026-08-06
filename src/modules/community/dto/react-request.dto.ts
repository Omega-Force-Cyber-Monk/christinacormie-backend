import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReactRequestDto {
  @ApiPropertyOptional({ example: 'LIKE', default: 'LIKE' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reaction?: string;
}
