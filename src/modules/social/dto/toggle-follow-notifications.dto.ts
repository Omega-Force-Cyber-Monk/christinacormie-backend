import { IsBoolean } from 'class-validator';

export class ToggleFollowNotificationsDto {
  @IsBoolean()
  notificationsEnabled: boolean;
}
