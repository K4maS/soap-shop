import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import jwt from 'jsonwebtoken'

// ─── Mocks (hoisted before imports) ───────────────────────────
vi.mock('../utils/redis.js', () => ({
  redis: {
    exists: vi.fn().mockResolvedValue(0), // not blacklisted by default
  },
  tokenBlacklist: vi.fn((jti: string) => `bl:${jti}`),
}))

vi.mock('../utils/jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}))

import { authenticate, requireRole, requireOwnership } from '../middleware/rbac.middleware.js'
import { redis } from '../utils/redis.js'
import { verifyAccessToken } from '../utils/jwt.js'
import { AppError } from '../middleware/error.middleware.js'

const mockExists = redis.exists as Mock
const mockVerify = verifyAccessToken as Mock

// ─── Test helpers ──────────────────────────────────────────────
function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    ip: '127.0.0.1',
    path: '/test',
    params: {},
    ...overrides,
  } as any
}

function makeRes() {
  return {} as any
}

function makeNext() {
  return vi.fn()
}

const VALID_PAYLOAD = {
  sub: 'user-uuid-1',
  role: 'customer',
  jti: 'jti-test-1',
  fingerprint: 'fp-test',
}

// ─────────────────────────────────────────────────────────────
// authenticate()
// ─────────────────────────────────────────────────────────────
describe('authenticate()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExists.mockResolvedValue(0)
    mockVerify.mockReturnValue(VALID_PAYLOAD)
  })

  it('calls next(AppError 401) when no Authorization header', async () => {
    const next = makeNext()
    await authenticate()(makeReq(), makeRes(), next)
    expect(next).toHaveBeenCalledOnce()
    const err = next.mock.calls[0][0]
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('UNAUTHORIZED')
  })

  it('calls next(AppError 401) when Authorization header has no "Bearer " prefix', async () => {
    const next = makeNext()
    await authenticate()(makeReq({ headers: { authorization: 'Basic abc' } }), makeRes(), next)
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401)
  })

  it('calls next(AppError 401) for a malformed token (wrong JWT format)', async () => {
    const next = makeNext()
    await authenticate()(makeReq({ headers: { authorization: 'Bearer notajwt' } }), makeRes(), next)
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401)
  })

  it('calls next(AppError 401 TOKEN_REVOKED) when token is blacklisted', async () => {
    mockExists.mockResolvedValue(1) // blacklisted
    const token = makeBearer()
    const next = makeNext()
    await authenticate()(makeReq({ headers: { authorization: `Bearer ${token}` } }), makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('TOKEN_REVOKED')
  })

  it('calls next(AppError 401 TOKEN_EXPIRED) for expired JWT', async () => {
    mockVerify.mockImplementation(() => { throw new jwt.TokenExpiredError('jwt expired', new Date()) })
    const next = makeNext()
    await authenticate()(makeReq({ headers: { authorization: `Bearer ${makeBearer()}` } }), makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('TOKEN_EXPIRED')
  })

  it('calls next(AppError 401 INVALID_TOKEN) for invalid JWT signature', async () => {
    mockVerify.mockImplementation(() => { throw new jwt.JsonWebTokenError('invalid signature') })
    const next = makeNext()
    await authenticate()(makeReq({ headers: { authorization: `Bearer ${makeBearer()}` } }), makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
    expect(err.code).toBe('INVALID_TOKEN')
  })

  it('sets req.user and calls next() with no args on success', async () => {
    const req = makeReq({ headers: { authorization: `Bearer ${makeBearer()}` } })
    const next = makeNext()
    await authenticate()(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith() // no error
    expect(req.user).toEqual({ id: VALID_PAYLOAD.sub, role: VALID_PAYLOAD.role, jti: VALID_PAYLOAD.jti })
  })
})

// ─────────────────────────────────────────────────────────────
// requireRole()
// ─────────────────────────────────────────────────────────────
describe('requireRole()', () => {
  it('calls next(AppError 401) when req.user is not set', () => {
    const next = makeNext()
    requireRole('admin')(makeReq(), makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(401)
  })

  it('calls next(AppError 403 FORBIDDEN) when role is not in the allowed list', () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'u1', role: 'customer', jti: 'j' }
    requireRole('admin', 'manager')(req, makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(403)
    expect(err.code).toBe('FORBIDDEN')
  })

  it('calls next() with no args when role matches', () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'u1', role: 'manager', jti: 'j' }
    requireRole('admin', 'manager')(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('accepts multiple allowed roles', () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'u1', role: 'accountant', jti: 'j' }
    requireRole('admin', 'manager', 'accountant')(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })
})

// ─────────────────────────────────────────────────────────────
// requireOwnership()
// ─────────────────────────────────────────────────────────────
describe('requireOwnership()', () => {
  it('calls next(AppError 401) when req.user is not set', async () => {
    const next = makeNext()
    await requireOwnership(async () => 'owner-id')(makeReq(), makeRes(), next)
    expect((next.mock.calls[0][0] as AppError).statusCode).toBe(401)
  })

  it('bypasses ownership check for admin role', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'admin-id', role: 'admin', jti: 'j' }
    await requireOwnership(async () => 'other-owner')(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('bypasses ownership check for manager role', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'mgr-id', role: 'manager', jti: 'j' }
    await requireOwnership(async () => 'other-owner')(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('calls next(AppError 404) when resource owner is null', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'user-1', role: 'customer', jti: 'j' }
    await requireOwnership(async () => null)(req, makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('returns 404 (not 403) for IDOR attempt to obscure resource existence', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'attacker-id', role: 'customer', jti: 'j' }
    await requireOwnership(async () => 'real-owner-id')(req, makeRes(), next)
    const err = next.mock.calls[0][0] as AppError
    expect(err.statusCode).toBe(404) // must not be 403
  })

  it('calls next() with no args when user owns the resource', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'owner-id', role: 'customer', jti: 'j' }
    await requireOwnership(async () => 'owner-id')(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith()
  })

  it('propagates errors thrown by getResourceOwnerId', async () => {
    const next = makeNext()
    const req = makeReq()
    req.user = { id: 'user-1', role: 'customer', jti: 'j' }
    const boom = new Error('db error')
    await requireOwnership(async () => { throw boom })(req, makeRes(), next)
    expect(next).toHaveBeenCalledWith(boom)
  })
})

// ─── Helper: craft a Bearer token string that passes format validation ────
function makeBearer(): string {
  // Just needs to match /^[\w-]+\.[\w-]+\.[\w-]+$/ for extractBearerToken
  return 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLXV1aWQtMSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
}
