import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class SnoozeInboxItemDto {
  @ApiPropertyOptional({
    description: 'ISO date string until when the item should be snoozed',
  })
  @IsOptional()
  @IsDateString()
  until?: string;
}
