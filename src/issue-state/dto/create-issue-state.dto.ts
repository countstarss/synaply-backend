import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { IssueStateCategory } from '../../../prisma/generated/prisma/enums';

export class CreateIssueStateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsEnum(IssueStateCategory)
  category?: IssueStateCategory;

  @IsOptional()
  @IsInt()
  position?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
