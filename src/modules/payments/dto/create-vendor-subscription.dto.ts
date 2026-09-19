import { ApiProperty } from '@nestjs/swagger';
import { VendorPlan } from '@prisma/client';
import { IsIn } from 'class-validator';

export class CreateVendorSubscriptionDto {
  @ApiProperty({
    enum: [VendorPlan.STARTER, VendorPlan.PRO, VendorPlan.ELITE],
    example: VendorPlan.STARTER,
  })
  @IsIn([VendorPlan.STARTER, VendorPlan.PRO, VendorPlan.ELITE])
  plan: Exclude<VendorPlan, 'FREE'>;
}
