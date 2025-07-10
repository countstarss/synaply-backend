import { IsString, IsOptional } from 'class-validator';

export class CreateIssueActivityDto {
  @IsString()
  action: string;

  @IsOptional()
  metadata?: unknown; // JSON
}
