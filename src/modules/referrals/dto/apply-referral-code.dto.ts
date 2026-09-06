import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ApplyReferralCodeDto {
  @ApiProperty({ example: 'FRIEND2026' })
  @IsString()
  @MaxLength(50)
  code: string;
}
