import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'The name of the workflow',
    example: 'Workflow 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
