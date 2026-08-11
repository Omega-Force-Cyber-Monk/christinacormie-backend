import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BasicMenuItemDto {
  @ApiProperty({ example: 'Birria Tacos' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'Slow-cooked braised beef tacos served with consommé for dipping' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'https://cdn.bitedrop.com/menu/birria-tacos.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ example: 14.99 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isVegetarian?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isVegan?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isGlutenFree?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class BasicMenuCategoryDto {
  @ApiProperty({ example: 'Main Courses' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Our signature gourmet taco combos' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ type: [BasicMenuItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasicMenuItemDto)
  items: BasicMenuItemDto[];
}

export class SetupBasicMenuDto {
  @ApiProperty({ example: 'Main Daily Menu' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Standard daily menu featuring tacos, burritos, and drinks' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [BasicMenuCategoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasicMenuCategoryDto)
  categories: BasicMenuCategoryDto[];
}
