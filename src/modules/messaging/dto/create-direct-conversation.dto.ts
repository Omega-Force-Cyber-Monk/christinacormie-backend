import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDirectConversationDto {
  @ApiPropertyOptional({
    example: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
    description:
      'User ID to start a direct chat with. Use this when the frontend already knows the recipient user.',
  })
  @IsOptional()
  @IsUUID()
  participantUserId?: string;

  @ApiPropertyOptional({
    example: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
    description:
      'Vendor ID. Backend will resolve the vendor owner user as the chat recipient.',
  })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({
    example: '7e7f3f6a-f047-49a4-8a01-4bbfd8e8ad1b',
    description:
      'Food truck ID. Backend will resolve the truck vendor owner user as the chat recipient.',
  })
  @IsOptional()
  @IsUUID()
  foodTruckId?: string;

  @ApiPropertyOptional({ example: 'Question about Taco Paradise' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;
}
