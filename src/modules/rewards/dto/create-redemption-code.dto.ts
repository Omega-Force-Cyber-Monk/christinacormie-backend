import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateRedemptionCodeDto {
  @ApiProperty({ example: 5, description: 'Dollar credit amount to redeem ($1 to $5)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  amount: number;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsOptional()
  @IsUUID()
  foodTruckId?: string;
}
