import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AwardBadgeDto {
  @ApiProperty({ example: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00' })
  @IsUUID()
  badgeId: string;

  @ApiPropertyOptional({ example: 'Achieved 10 food truck check-ins milestone' })
  @IsOptional()
  @IsString()
  awardedReason?: string;
}
