import { getAuthConfig } from './auth.config';

describe('Auth config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.SUPABASE_URL = 'http://127.0.0.1:54321/';
    process.env.JWT_SECRET =
      'super-secret-jwt-token-with-at-least-32-characters-long';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads auth config from env and trims the Supabase URL', () => {
    expect(getAuthConfig()).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseJwtIssuer: 'http://127.0.0.1:54321/auth/v1',
      jwtSecret: 'super-secret-jwt-token-with-at-least-32-characters-long',
    });
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => getAuthConfig()).toThrow(
      'JWT_SECRET is required for auth configuration.',
    );
  });

  it('throws when JWT_SECRET is too short', () => {
    process.env.JWT_SECRET = 'too-short';

    expect(() => getAuthConfig()).toThrow(
      'JWT_SECRET must be at least 32 characters long.',
    );
  });
});
