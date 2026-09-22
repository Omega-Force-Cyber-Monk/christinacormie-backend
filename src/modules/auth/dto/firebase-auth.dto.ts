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

export class FirebaseAuthDto {
  @ApiProperty({
    description:
      'Firebase Auth ID token from Flutter after Google or Apple sign-in',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...',
  })
  @IsString()
  idToken!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.CUSTOMER,
    description:
      'Role to assign when creating a new account through Firebase Auth',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: 'Tasty Tacos Food Truck',
    description:
      'Optional. If missing for a new vendor, backend creates a draft vendor profile and returns onboarding.requiresVendorOnboarding=true.',
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
