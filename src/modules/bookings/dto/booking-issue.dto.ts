import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class BookingIssueDto {
  @ApiProperty({
    example: 'The service was not completed as agreed.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Please describe the issue' })
  @MaxLength(2000, {
    message: 'Issue message must be 2000 characters or less',
  })
  message: string;
}

export class BookingIssueMessageDto {
  @ApiProperty({
    example: 'I cannot reach my client.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Please enter a message' })
  @MaxLength(2000, {
    message: 'Message must be 2000 characters or less',
  })
  message: string;
}
