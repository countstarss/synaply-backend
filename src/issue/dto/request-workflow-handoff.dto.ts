import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestWorkflowHandoffDto {
  @ApiProperty({
    description: 'Target handoff user ID',
  })
  @IsString()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Target handoff display name',
  })
  @IsOptional()
  @IsString()
  targetName?: string;

  @ApiPropertyOptional({
    description: 'Optional handoff note',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
