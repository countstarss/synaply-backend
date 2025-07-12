import { IsOptional, IsString, IsISO8601 } from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @IsOptional()
  @IsString()
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}
