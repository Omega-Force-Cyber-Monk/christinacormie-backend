import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum BookingIssueResolutionDecisionDto {
  RELEASE_PAYOUT = 'RELEASE_PAYOUT',
  FULL_REFUND = 'FULL_REFUND',
}

export class ResolveBookingIssueDto {
  @ApiProperty({
    enum: BookingIssueResolutionDecisionDto,
    example: BookingIssueResolutionDecisionDto.RELEASE_PAYOUT,
  })
  @IsEnum(BookingIssueResolutionDecisionDto)
  decision: BookingIssueResolutionDecisionDto;

  @ApiPropertyOptional({
    example: 'Vendor completed the service and customer dispute was reviewed.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolutionNote?: string;
}
