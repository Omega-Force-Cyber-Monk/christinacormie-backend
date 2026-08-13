import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID token from client sign-in flow',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.CUSTOMER,
    description: 'Role to assign when creating a new account through Google sign-in',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: 'Tasty Tacos Food Truck',
    description: 'Required when creating a new vendor through Google sign-in',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({ example: '1994-08-12' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateOfBirth?: Date;
}
