import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export enum AdminTruckStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class UpdateFoodTruckAdminDto {
  @ApiPropertyOptional({ enum: AdminTruckStatusDto, example: AdminTruckStatusDto.ACTIVE })
  @IsOptional()
  @IsEnum(AdminTruckStatusDto)
  status?: AdminTruckStatusDto;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}
