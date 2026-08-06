import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  nearbyDropAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  followedTruckUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  favoriteTruckAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  promotionAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  bookingAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  messageAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  rewardAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  checkInAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  marketingAlerts?: boolean;
}
