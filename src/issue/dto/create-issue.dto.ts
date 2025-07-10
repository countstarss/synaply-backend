import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
// import { IssuePriority, IssueStatus, VisibilityType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// MARK: - CreateIssueDto
export class CreateIssueDto {
  @ApiProperty({
    description: 'The title of the issue',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'The description of the issue',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The workspace ID of the issue',
  })
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @ApiPropertyOptional({
    description: 'The direct assignee ID of the issue',
  })
  @IsOptional()
  @IsString()
  directAssigneeId?: string;

  @ApiPropertyOptional({
    description: 'The due date of the issue',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;
}
