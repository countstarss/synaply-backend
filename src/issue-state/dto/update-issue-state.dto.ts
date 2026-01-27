import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueStateDto } from './create-issue-state.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateIssueStateDto extends PartialType(CreateIssueStateDto) {
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
