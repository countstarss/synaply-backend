import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { IssueStatus } from '../../../prisma/generated/prisma/client';

export class UpdateWorkflowRunStatusDto {
  @ApiProperty({
    description: 'New workflow step status',
    enum: IssueStatus,
  })
  @IsEnum(IssueStatus)
  status: IssueStatus;

  @ApiPropertyOptional({
    description: 'Optional comment for the status change',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
