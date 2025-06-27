import { jwtVerify } from 'jose';

// 从环境变量中获取 Supabase URL 和 JWT Secret
const SUPABASE_URL = 'http://127.0.0.1:54321';
const JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

export async function verifyJwt(token: string) {
  try {
    // 将秘密密钥转换为 JWK 格式
    const secretJwk = new TextEncoder().encode(JWT_SECRET);

    const { payload } = await jwtVerify(token, secretJwk, {
      issuer: `${SUPABASE_URL}/auth/v1`, // Supabase JWT 的签发者
    });
    return payload;
  } catch (err) {
    console.error('JWT verification failed:', err);
    return null;
  }
}
