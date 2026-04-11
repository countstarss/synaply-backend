import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class AssembleCodingPromptDto {
  @ApiProperty({
    description: '需要组装 handoff prompt 的 issue ID',
  })
  @IsString()
  @IsUUID()
  issueId!: string;
}
