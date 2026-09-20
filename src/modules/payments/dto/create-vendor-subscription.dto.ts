import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateVendorSubscriptionDto {
  @ApiProperty({
    example: '0d2ad84f-7acb-48f2-b6f5-f30275d106e4',
    description: 'Admin-created subscription tier ID.',
  })
  @IsUUID()
  tierId: string;
}
