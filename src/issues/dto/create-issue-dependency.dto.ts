import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIssueDependencyDto {
  @IsNotEmpty()
  @IsString()
  dependsOnIssueId: string;
}
