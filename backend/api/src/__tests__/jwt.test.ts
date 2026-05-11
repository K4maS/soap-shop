import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import { verifyAccessToken } from '../utils/jwt.js'

const SECRET = 'test-access-secret-minimum-32-chars-long' // must match setup.ts

function makeValidToken(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    { sub: 'user-uuid-1', role: 'customer', jti: 'jti-abc', fingerprint: 'fp-xyz', ...overrides },
    SECRET,
    { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api', expiresIn: '1h' }
  )
}

// ─────────────────────────────────────────────────────────────
// Happy path
// ─────────────────────────────────────────────────────────────
describe('verifyAccessToken — valid token', () => {
  it('returns the decoded payload', () => {
    const payload = verifyAccessToken(makeValidToken())
    expect(payload.sub).toBe('user-uuid-1')
    expect(payload.role).toBe('customer')
    expect(payload.jti).toBe('jti-abc')
    expect(payload.fingerprint).toBe('fp-xyz')
  })

  it('accepts every valid role', () => {
    for (const role of ['customer', 'manager', 'admin', 'accountant']) {
      const payload = verifyAccessToken(makeValidToken({ role }))
      expect(payload.role).toBe(role)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// Signature / format errors
// ─────────────────────────────────────────────────────────────
describe('verifyAccessToken — invalid tokens', () => {
  it('throws JsonWebTokenError for wrong secret', () => {
    const bad = jwt.sign(
      { sub: 'u', role: 'customer', jti: 'j', fingerprint: 'f' },
      'wrong-secret-minimum-32-chars-padding',
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api' }
    )
    expect(() => verifyAccessToken(bad)).toThrow(jwt.JsonWebTokenError)
  })

  it('throws TokenExpiredError for an expired token', () => {
    // Pass exp directly in payload (without expiresIn option to avoid conflict)
    const expired = jwt.sign(
      {
        sub: 'u',
        role: 'customer',
        jti: 'j',
        fingerprint: 'f',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      SECRET,
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api' }
    )
    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError)
  })

  it('throws JsonWebTokenError for wrong issuer', () => {
    const bad = jwt.sign(
      { sub: 'u', role: 'customer', jti: 'j', fingerprint: 'f' },
      SECRET,
      { algorithm: 'HS256', issuer: 'wrong-issuer', audience: 'mylo-api' }
    )
    expect(() => verifyAccessToken(bad)).toThrow(jwt.JsonWebTokenError)
  })

  it('throws JsonWebTokenError for wrong audience', () => {
    const bad = jwt.sign(
      { sub: 'u', role: 'customer', jti: 'j', fingerprint: 'f' },
      SECRET,
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'wrong-audience' }
    )
    expect(() => verifyAccessToken(bad)).toThrow(jwt.JsonWebTokenError)
  })

  it('throws JsonWebTokenError for a completely malformed string', () => {
    expect(() => verifyAccessToken('not.a.valid.jwt')).toThrow(jwt.JsonWebTokenError)
  })

  it('throws JsonWebTokenError for an empty string', () => {
    expect(() => verifyAccessToken('')).toThrow(jwt.JsonWebTokenError)
  })
})

// ─────────────────────────────────────────────────────────────
// Missing required claims
// ─────────────────────────────────────────────────────────────
describe('verifyAccessToken — missing required claims', () => {
  it('throws when fingerprint claim is absent', () => {
    // No fingerprint → structural guard rejects it
    const token = jwt.sign(
      { sub: 'u', role: 'customer', jti: 'j' }, // no fingerprint
      SECRET,
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api', expiresIn: '1h' }
    )
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError)
  })

  it('throws when jti claim is absent', () => {
    const token = jwt.sign(
      { sub: 'u', role: 'customer', fingerprint: 'f' }, // no jti
      SECRET,
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api', expiresIn: '1h' }
    )
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError)
  })

  it('throws when role claim is absent', () => {
    const token = jwt.sign(
      { sub: 'u', jti: 'j', fingerprint: 'f' }, // no role
      SECRET,
      { algorithm: 'HS256', issuer: 'mylo-auth', audience: 'mylo-api', expiresIn: '1h' }
    )
    expect(() => verifyAccessToken(token)).toThrow(jwt.JsonWebTokenError)
  })
})
