import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNewFoodTruckRequestDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'COMMUNICATED', 'DISMISSED'],
    example: 'COMMUNICATED',
  })
  @IsOptional()
  @IsIn(['PENDING', 'COMMUNICATED', 'DISMISSED'])
  status?: string;

  @ApiPropertyOptional({ example: 'Called owner and shared onboarding link.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
