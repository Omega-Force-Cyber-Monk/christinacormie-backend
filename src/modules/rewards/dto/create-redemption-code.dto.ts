import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateRedemptionCodeDto {
  @ApiPropertyOptional({
    example: 5,
    description:
      'Dollar credit amount to redeem ($1 to $5). Required when rewardRuleId is not provided.',
  })
  @ValidateIf((dto: CreateRedemptionCodeDto) => !dto.rewardRuleId)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  amount?: number;

  @ApiPropertyOptional({
    example: '076d4c8e-0f2b-48f7-9652-b2dc1f5a9fb3',
    description:
      'Reward campaign/rule to generate a QR/code for. When provided, backend uses the rule amount, points, funding type, minimum purchase, and limits.',
  })
  @IsOptional()
  @IsUUID()
  rewardRuleId?: string;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  @IsOptional()
  @IsUUID()
  foodTruckId?: string;
}
