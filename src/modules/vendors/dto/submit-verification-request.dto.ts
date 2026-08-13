import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { VendorVerificationDocumentType } from '../enums/vendor-verification-document-type.enum';

export class VerificationDocumentDto {
  @ApiProperty({
    enum: VendorVerificationDocumentType,
    example: VendorVerificationDocumentType.FOOD_MANAGER_CERTIFICATION,
  })
  @IsEnum(VendorVerificationDocumentType)
  type: VendorVerificationDocumentType;

  @ApiProperty({ example: 'https://cdn.bitedrop.com/documents/permit-2026.pdf' })
  @IsString()
  url: string;
}

export class SubmitVerificationRequestDto {
  @ApiProperty({ type: [VerificationDocumentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents: VerificationDocumentDto[];

  @ApiPropertyOptional({ example: 'Submitted food safety permit and health department license.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
