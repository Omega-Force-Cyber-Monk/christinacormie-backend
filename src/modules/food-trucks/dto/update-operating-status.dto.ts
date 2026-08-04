import { IsEnum } from 'class-validator';

export enum OperatingStatusDto {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  BUSY = 'BUSY',
  UNAVAILABLE = 'UNAVAILABLE',
}

export class UpdateOperatingStatusDto {
  @IsEnum(OperatingStatusDto)
  operatingStatus: OperatingStatusDto;
}
