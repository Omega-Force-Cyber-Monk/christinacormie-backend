import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VendorConfirmRedemptionDto {
  @ApiPropertyOptional({ example: 'rdm_847291_a1b2c3' })
  @IsOptional()
  @IsString()
  redemptionToken?: string;

  @ApiPropertyOptional({ example: '847291' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  manualCode?: string;
}
