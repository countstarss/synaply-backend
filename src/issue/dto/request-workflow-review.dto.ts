import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RequestWorkflowReviewDto {
  @ApiProperty({
    description: 'Target reviewer user ID',
  })
  @IsString()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Target reviewer display name',
  })
  @IsOptional()
  @IsString()
  targetName?: string;

  @ApiPropertyOptional({
    description: 'Optional review request note',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
