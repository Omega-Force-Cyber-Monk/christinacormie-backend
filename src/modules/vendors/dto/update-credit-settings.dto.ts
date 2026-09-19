import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateCreditSettingsDto {
  @ApiProperty({
    example: true,
    description: 'Whether this vendor currently accepts BiteDrop Credits.',
  })
  @IsBoolean()
  creditAcceptanceEnabled: boolean;
}
