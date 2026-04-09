import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ClearInboxItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  itemIds!: string[];
}
