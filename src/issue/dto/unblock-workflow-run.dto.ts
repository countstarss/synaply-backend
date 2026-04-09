import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IssueStatus } from '../../../prisma/generated/prisma/client';

export class UnblockWorkflowRunDto {
  @ApiPropertyOptional({
    description: 'Comment for unblocking the workflow run',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Status to restore after unblocking',
    enum: IssueStatus,
    default: IssueStatus.TODO,
  })
  @IsOptional()
  @IsEnum(IssueStatus)
  restoreStatus?: IssueStatus;
}
