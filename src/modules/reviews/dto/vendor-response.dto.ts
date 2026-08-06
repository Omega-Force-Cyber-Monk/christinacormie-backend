import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VendorResponseDto {
  @ApiProperty({ example: 'Thank you for your feedback! We are thrilled your guests enjoyed our tacos.' })
  @IsString()
  @MaxLength(2000)
  vendorResponse: string;
}
