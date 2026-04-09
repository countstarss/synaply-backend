import { TransformFnParams } from 'class-transformer';

export function emptyStringToUndefined({ value }: TransformFnParams) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
