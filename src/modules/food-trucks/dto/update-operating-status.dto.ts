import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum OperatingStatusDto {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  BUSY = 'BUSY',
  UNAVAILABLE = 'UNAVAILABLE',
}

export class UpdateOperatingStatusDto {
  @ApiProperty({ enum: OperatingStatusDto, example: OperatingStatusDto.OPEN })
  @IsEnum(OperatingStatusDto)
  operatingStatus: OperatingStatusDto;
}
