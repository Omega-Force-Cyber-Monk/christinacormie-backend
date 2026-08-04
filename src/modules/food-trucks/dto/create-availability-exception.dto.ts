import { IsBoolean, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateAvailabilityExceptionDto {
  @IsISO8601({ strict: true })
  exceptionDate: string;

  @IsBoolean()
  isAvailable: boolean;

  @IsOptional()
  @Matches(TIME_PATTERN)
  openingTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  closingTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
