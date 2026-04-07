import { IsString, IsInt, IsOptional } from 'class-validator';

export class CreateIssueStepRecordDto {
  @IsString()
  stepId: string;

  @IsString()
  stepName: string;

  @IsInt()
  index: number;

  @IsOptional()
  @IsString()
  resultText?: string;

  @IsOptional()
  attachments?: unknown; // JSON

  @IsString()
  assigneeId: string;
}
