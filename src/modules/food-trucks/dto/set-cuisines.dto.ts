import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CuisineSelectionDto {
  @IsOptional()
  @IsUUID()
  cuisineId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pinColor?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class SetCuisinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuisineSelectionDto)
  cuisines: CuisineSelectionDto[];
}
