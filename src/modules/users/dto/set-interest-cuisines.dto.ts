import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class SetInterestCuisinesDto {
  @ApiProperty({
    example: [
      'f5eebc99-9c0b-4ef8-bb6d-6bb9bd380a66',
      '2d579ad7-631f-4f52-88c7-d2d9312f0ca3',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  cuisineIds: string[];
}
