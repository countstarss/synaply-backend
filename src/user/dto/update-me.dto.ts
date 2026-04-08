import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const trimToNullableString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
};

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: '用户显示名称',
    example: 'Luke',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNullableString)
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiPropertyOptional({
    description: '头像 URL',
    example: 'https://example.com/avatar.png',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimToNullableString)
  @IsString()
  @IsUrl({ require_protocol: true }, { message: 'avatarUrl 必须是合法的 URL' })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
