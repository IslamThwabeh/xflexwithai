import { SignJWT, jwtVerify } from 'jose';
import { ENV } from './env';

const AUDIENCE = 'xflex-client-guide';
const secretKey = () => {
  if (!ENV.jwtSecret) throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(ENV.jwtSecret);
};

export async function generateClientGuidePlaybackToken(slug: string, userId: number) {
  return new SignJWT({ kind: 'client_guide', slug })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId))
    .setAudience(AUDIENCE).setIssuedAt().setExpirationTime('2h').sign(secretKey());
}

export async function verifyClientGuidePlaybackToken(token: string, slug: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { audience: AUDIENCE, algorithms: ['HS256'] });
    return payload.kind === 'client_guide' && payload.slug === slug && Boolean(payload.sub);
  } catch {
    return false;
  }
}
