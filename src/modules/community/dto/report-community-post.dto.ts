import { ApiProperty } from '@nestjs/swagger';
import { CommunityPostReportReason } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ReportCommunityPostDto {
  @ApiProperty({
    enum: CommunityPostReportReason,
    example: CommunityPostReportReason.SPAM_OR_IRRELEVANT,
  })
  @IsEnum(CommunityPostReportReason, {
    message:
      'reason must be one of: SPAM_OR_IRRELEVANT, INAPPROPRIATE_CONTENT, HARASSMENT, SCAM_OR_FRAUD, NOT_FOOD_TRUCK_RELATED',
  })
  reason: CommunityPostReportReason;
}

