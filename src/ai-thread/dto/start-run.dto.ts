import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartRunDto {
  @ApiProperty({ description: 'LLM model id' })
  @IsString()
  model!: string;

  @ApiPropertyOptional({ description: '最大步数', minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxSteps?: number;

  @ApiPropertyOptional({
    description: 'token 预算',
    minimum: 1000,
    maximum: 500000,
  })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(500_000)
  tokenBudget?: number;
}
