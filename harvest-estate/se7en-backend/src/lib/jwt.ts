import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignJwtOptions {
  expiresInSeconds?: number;
  issuer?: string;
  audience?: string | string[];
  notBeforeSeconds?: number;
}

export interface VerifyJwtOptions {
  issuer?: string;
  audience?: string | string[];
}

export interface JwtClaims extends Record<string, unknown> {
  sub?: string;
  role?: string;
  email?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function ensureArray(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function signJwt(payload: JwtClaims, secret: string, options: SignJwtOptions = {}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const claims: JwtClaims = {
    iat: now,
    ...payload,
  };

  if (options.expiresInSeconds) {
    claims.exp = now + options.expiresInSeconds;
  }
  if (options.notBeforeSeconds) {
    claims.nbf = now + options.notBeforeSeconds;
  }
  if (options.issuer) {
    claims.iss = options.issuer;
  }
  if (options.audience) {
    claims.aud = options.audience;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt(token: string, secret: string, options: VerifyJwtOptions = {}): JwtClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('invalid_token_format');
  }

  const [encodedHeader, encodedPayload, signature] = parts;

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', secret).update(signingInput).digest();
  const providedSignature = Buffer.from(signature, 'base64url');

  if (expectedSignature.length !== providedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('invalid_signature');
  }

  const header = JSON.parse(base64UrlDecode(encodedHeader)) as { alg?: string };
  if (header.alg !== 'HS256') {
    throw new Error('unsupported_algorithm');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as JwtClaims;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp != null && now >= payload.exp) {
    throw new Error('token_expired');
  }
  if (payload.nbf != null && now < payload.nbf) {
    throw new Error('token_not_active');
  }

  if (options.issuer && payload.iss !== options.issuer) {
    throw new Error('invalid_issuer');
  }

  if (options.audience) {
    const allowedAudiences = ensureArray(options.audience);
    const tokenAudiences = ensureArray(payload.aud);
    const intersection = tokenAudiences.filter((audience) => allowedAudiences.includes(audience));
    if (tokenAudiences.length === 0 || intersection.length === 0) {
      throw new Error('invalid_audience');
    }
  }

  return payload;
}
