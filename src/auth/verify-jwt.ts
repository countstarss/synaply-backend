import { jwtVerify } from 'jose';
import { getAuthConfig } from './auth.config';

export async function verifyJwt(token: string) {
  const { jwtSecret, supabaseJwtIssuer } = getAuthConfig();

  try {
    const secretKey = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(token, secretKey, {
      issuer: supabaseJwtIssuer,
      algorithms: ['HS256'],
    });

    return payload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
