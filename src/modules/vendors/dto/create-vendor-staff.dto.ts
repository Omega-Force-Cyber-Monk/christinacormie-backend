import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

export class CreateVendorStaffDto {
  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail({}, { message: 'Staff email must be a valid email address' })
  email: string;

  @ApiProperty({ example: '1504', description: '4-digit staff login PIN' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Staff PIN must be exactly 4 digits' })
  pin: string;
}

