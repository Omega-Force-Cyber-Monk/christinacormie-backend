import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateVendorFoundingMemberDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFoundingMember?: boolean;

  @ApiPropertyOptional({ example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lockedCommissionRate?: number;

  @ApiPropertyOptional({ example: 'Client-approved founding vendor override' })
  @IsOptional()
  @IsString()
  reason?: string;
}

