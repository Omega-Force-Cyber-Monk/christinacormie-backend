import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class OperatingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsOptional()
  @Matches(TIME_PATTERN)
  openingTime?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  closingTime?: string;

  @IsBoolean()
  isClosed: boolean;
}

export class SetOperatingHoursDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OperatingHourDto)
  hours: OperatingHourDto[];
}
