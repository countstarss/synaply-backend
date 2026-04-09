import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AcceptWorkflowHandoffDto {
  @ApiPropertyOptional({
    description: 'Optional comment when accepting the pending handoff',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
