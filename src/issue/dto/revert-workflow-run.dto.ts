import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RevertWorkflowRunDto {
  @ApiPropertyOptional({
    description: 'Optional comment for reverting the workflow run',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
