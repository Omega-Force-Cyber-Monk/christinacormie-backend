import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'WEB', enum: ['ANDROID', 'IOS', 'WEB'] })
  @IsString()
  @IsIn(['ANDROID', 'IOS', 'WEB'])
  platform: string;

  @ApiPropertyOptional({ example: 'iphone-15-pro-user-1' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deviceId?: string;
}
