import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RedeemRewardDto {
  @ApiProperty({ example: 'r1eebc99-9c0b-4ef8-bb6d-6bb9bd380a88' })
  @IsUUID()
  rewardRuleId: string;
}
