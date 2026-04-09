import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BlockWorkflowRunDto {
  @ApiPropertyOptional({
    description: 'Reason why the workflow run is blocked',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
