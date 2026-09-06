import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleFollowNotificationsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  notificationsEnabled: boolean;
}
