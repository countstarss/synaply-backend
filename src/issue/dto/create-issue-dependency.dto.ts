import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIssueDependencyDto {
  @ApiProperty({
    description: 'The ID of the issue that this issue depends on',
  })
  @IsNotEmpty()
  @IsString()
  dependsOnIssueId: string;
}
