import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, MaxLength } from 'class-validator';

export class RequestMediaDto {
  @ApiProperty({ example: 'https://cdn.bitedrop.com/media/event-flyer.jpg' })
  @IsUrl()
  mediaUrl: string;

  @ApiProperty({ example: 'IMAGE' })
  @IsString()
  @MaxLength(20)
  mediaType: string;
}
