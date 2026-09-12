import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, IsUrl, MaxLength } from 'class-validator';

export class RequestMediaDto {
  @ApiProperty({ example: 'https://cdn.bitedrop.com/media/event-flyer.jpg' })
  @IsUrl()
  mediaUrl: string;

  @ApiProperty({ example: 'IMAGE', enum: ['IMAGE', 'PDF'] })
  @IsIn(['IMAGE', 'PDF'], { message: 'mediaType must be IMAGE or PDF' })
  @IsString()
  @MaxLength(20)
  mediaType: string;
}
