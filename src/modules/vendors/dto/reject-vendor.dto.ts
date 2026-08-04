import { IsString, MaxLength } from 'class-validator';

export class RejectVendorDto {
  @IsString()
  @MaxLength(1000)
  rejectionReason: string;
}
