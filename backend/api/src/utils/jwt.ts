import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

// =============================================================
// JWT utilities — access token verification for the API service
// The API service only verifies tokens; it never issues them.
// Token issuance lives in the auth-service.
// =============================================================

/**
 * Claims embedded in every access token signed by the auth-service.
 *
 * sub         — user UUID (subject)
 * role        — RBAC role: customer | manager | admin | accountant
 * jti         — unique token ID, used to check the blacklist in Redis
 * fingerprint — SHA-256 of the device fingerprint, bound at issue time
 */
export interface AccessTokenPayload {
  sub: string;
  role: string;
  jti: string;
  fingerprint: string;
}

/**
 * Verifies an access token and returns the decoded payload.
 *
 * Throws:
 *   jwt.JsonWebTokenError   — invalid signature / malformed
 *   jwt.TokenExpiredError   — token has expired
 *   jwt.NotBeforeError      — token not yet valid
 *
 * Security properties validated:
 *   - algorithm must be HS256 (rejects RS256/none/etc.)
 *   - issuer must be 'mylo-auth'
 *   - audience must be 'mylo-api'
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
    issuer: 'mylo-auth',
    audience: 'mylo-api',
  }) as AccessTokenPayload;

  // Structural guard — ensure required claims are present
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.role !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.fingerprint !== 'string'
  ) {
    throw new jwt.JsonWebTokenError('Token payload is missing required claims');
  }

  return payload;
}
