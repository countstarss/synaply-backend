const MINIMUM_JWT_SECRET_LENGTH = 32;

function getRequiredEnv(name: 'SUPABASE_URL' | 'JWT_SECRET') {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for auth configuration.`);
  }

  return value;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function getAuthConfig() {
  const supabaseUrl = trimTrailingSlash(getRequiredEnv('SUPABASE_URL'));
  const jwtSecret = getRequiredEnv('JWT_SECRET');

  if (jwtSecret.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters long.`,
    );
  }

  return {
    supabaseUrl,
    supabaseJwtIssuer: `${supabaseUrl}/auth/v1`,
    jwtSecret,
  };
}
