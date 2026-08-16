import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { VendorVerificationDocumentType } from '../enums/vendor-verification-document-type.enum';

export class VerificationDocumentDto {
  @ApiProperty({
    enum: VendorVerificationDocumentType,
    example: VendorVerificationDocumentType.DSHS_MOBILE_FOOD_VENDOR_LICENSE,
  })
  @IsEnum(VendorVerificationDocumentType)
  type: VendorVerificationDocumentType;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/raw/upload/v1/bitedrop/vendors/vendor-id/verification-documents/permit-2026.pdf',
    description:
      'Cloudinary file URL returned by POST /api/v1/vendors/me/verification-requests/upload',
  })
  @IsString()
  url: string;
}

export class SubmitVerificationRequestDto {
  @ApiProperty({ type: [VerificationDocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents: VerificationDocumentDto[];

  @ApiPropertyOptional({ example: 'Demo verification documents submitted for review.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
