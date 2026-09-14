import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ResetVendorStaffPinDto {
  @ApiProperty({ example: '5678', description: 'New 4-digit staff login PIN' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Staff PIN must be exactly 4 digits' })
  pin: string;
}

