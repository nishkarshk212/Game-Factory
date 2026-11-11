import crypto from 'node:crypto';
import { config } from '../config.js';

export interface SessionClaims {
  sub: string; // internal user UUID
  tgId: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function signSessionToken(
  payload: Omit<SessionClaims, 'iat' | 'exp'>,
  ttlSeconds = 7 * 24 * 3600,
  secret = config.jwtSecret
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullClaims: SessionClaims = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds
  };
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullClaims));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  return `${header}.${body}.${sig}`;
}

export function verifySessionToken(token: string, secret = config.jwtSecret): SessionClaims {
  if (!token || typeof token !== 'string') {
    throw new Error('Missing authentication token');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed token');
  }
  const [header, body, sig] = parts;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid token signature');
  }
  const claims = JSON.parse(base64UrlDecode(body)) as SessionClaims;
  const now = Math.floor(Date.now() / 1000);
  if (!claims.sub || !claims.exp || claims.exp < now) {
    throw new Error('Token expired');
  }
  return claims;
}

