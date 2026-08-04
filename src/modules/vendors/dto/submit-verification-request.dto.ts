import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class VerificationDocumentDto {
  @IsString()
  type: string;

  @IsString()
  url: string;
}

export class SubmitVerificationRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerificationDocumentDto)
  documents: VerificationDocumentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
