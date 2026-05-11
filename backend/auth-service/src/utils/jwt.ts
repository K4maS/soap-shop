import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { hashToken } from './crypto.js';

// =============================================================
// JWT utilities — secure token management
// =============================================================

export interface AccessTokenPayload {
  sub: string;        // userId
  role: string;
  jti: string;        // token ID для revocation
  fingerprint: string; // device fingerprint hash
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

/**
 * Создаёт Access Token (15 минут)
 * Security: содержит fingerprint для привязки к устройству
 */
export function signAccessToken(
  userId: string,
  role: string,
  jti: string,
  fingerprint: string
): string {
  return jwt.sign(
    {
      sub: userId,
      role,
      jti,
      fingerprint: hashToken(fingerprint), // храним hash fingerprint, не сам
    } satisfies AccessTokenPayload,
    config.JWT_ACCESS_SECRET,
    {
      expiresIn: config.JWT_ACCESS_EXPIRES as any,
      algorithm: 'HS256',
      issuer: 'mylo-auth',
      audience: 'mylo-api',
    }
  );
}

/**
 * Создаёт Refresh Token (7 дней)
 * Security: отдельный secret, тип 'refresh' для предотвращения
 * использования refresh token как access token
 */
export function signRefreshToken(userId: string, jti: string): string {
  return jwt.sign(
    {
      sub: userId,
      jti,
      type: 'refresh',
    } satisfies RefreshTokenPayload,
    config.JWT_REFRESH_SECRET,
    {
      expiresIn: config.JWT_REFRESH_EXPIRES as any,
      algorithm: 'HS256',
      issuer: 'mylo-auth',
      audience: 'mylo-api',
    }
  );
}

/**
 * Верифицирует Access Token
 * Throws: jwt.JsonWebTokenError, jwt.TokenExpiredError
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'mylo-auth',
    audience: 'mylo-api',
  }) as AccessTokenPayload;
}

/**
 * Верифицирует Refresh Token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, config.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
    issuer: 'mylo-auth',
    audience: 'mylo-api',
  }) as RefreshTokenPayload;

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return payload;
}

/**
 * Decode без верификации — только для чтения claims
 * Security: НИКОГДА не использовать для security decisions
 */
export function decodeToken(token: string): jwt.JwtPayload | null {
  return jwt.decode(token) as jwt.JwtPayload | null;
}
