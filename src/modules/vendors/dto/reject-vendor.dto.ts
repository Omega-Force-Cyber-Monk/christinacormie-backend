import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class RejectVendorDto {
  @ApiProperty({ example: 'Incomplete business permit documents provided. Please upload a valid health safety license.' })
  @IsString()
  @MaxLength(1000)
  rejectionReason: string;
}
