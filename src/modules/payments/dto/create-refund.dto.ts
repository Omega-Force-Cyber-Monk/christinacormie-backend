import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateRefundDto {
  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ example: 'Customer cancelled booking in advance per policy' })
  @IsOptional()
  @IsString()
  reason?: string;
}
