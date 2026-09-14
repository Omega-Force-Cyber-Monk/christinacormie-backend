import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export enum MessagingMessageTypeDto {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FILE = 'FILE',
}

export class SendMessageDto {
  @ApiPropertyOptional({
    enum: MessagingMessageTypeDto,
    example: MessagingMessageTypeDto.TEXT,
    description:
      'Defaults to TEXT when omitted. SYSTEM messages are backend-only.',
  })
  @IsOptional()
  @IsEnum(MessagingMessageTypeDto)
  messageType?: MessagingMessageTypeDto;

  @ApiProperty({
    example: 'Hi, are you available for this booking?',
    description:
      'Message text. Required for TEXT messages and optional when an attachment URL is sent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1/bitedrop/messages/photo.jpg',
  })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}
