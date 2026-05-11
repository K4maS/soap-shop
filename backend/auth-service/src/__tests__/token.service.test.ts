import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ─── Mock Redis ────────────────────────────────────────────────
const mockPipeline = {
  setex: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
}

vi.mock('../utils/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    pipeline: vi.fn(() => mockPipeline),
  },
  tokenBlacklist: vi.fn((jti: string) => `token:blacklist:${jti}`),
}))

import { TokenService } from '../services/token.service.js'
import { redis, tokenBlacklist } from '../utils/redis.js'
import jwt from 'jsonwebtoken'

const mockRedisSetex = redis.setex as Mock
const mockRedisPipeline = redis.pipeline as Mock

// ─── Shared mock Prisma factory ────────────────────────────────
function buildMockPrisma() {
  return {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  }
}

// ─── Test data ─────────────────────────────────────────────────
const TEST_USER_ID = 'user-uuid-1111'
const TEST_ROLE = 'customer'
const TEST_TOKEN_ID = 'token-uuid-2222'
const DEVICE_INFO = {
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  deviceId: 'device-abc',
  deviceName: 'My Phone',
}

const FUTURE_EXPIRES = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const PAST_EXPIRES = new Date(Date.now() - 1000)

function makeStoredToken(overrides: Partial<{
  id: string
  userId: string
  tokenHash: string
  isRevoked: boolean
  expiresAt: Date
  user: { id: string; role: string; status: string; deletedAt: Date | null }
}> = {}) {
  return {
    id: TEST_TOKEN_ID,
    userId: TEST_USER_ID,
    tokenHash: 'some-hash',
    isRevoked: false,
    expiresAt: FUTURE_EXPIRES,
    deviceId: DEVICE_INFO.deviceId,
    deviceName: DEVICE_INFO.deviceName,
    ipAddress: DEVICE_INFO.ip,
    userAgent: DEVICE_INFO.userAgent,
    user: {
      id: TEST_USER_ID,
      role: TEST_ROLE,
      status: 'active',
      deletedAt: null,
    },
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// createTokenPair
// ─────────────────────────────────────────────────────────────
describe('TokenService.createTokenPair', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: TokenService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new TokenService(prisma as any)
    prisma.refreshToken.create.mockResolvedValue({ id: TEST_TOKEN_ID })
  })

  it('returns a pair of JWT strings', async () => {
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    expect(typeof pair.accessToken).toBe('string')
    expect(typeof pair.refreshToken).toBe('string')
  })

  it('accessToken is a verifiable JWT with expected claims', async () => {
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    const decoded = jwt.decode(pair.accessToken) as any
    expect(decoded).not.toBeNull()
    expect(decoded.sub).toBe(TEST_USER_ID)
    expect(decoded.role).toBe(TEST_ROLE)
    expect(typeof decoded.jti).toBe('string')
  })

  it('refreshToken is a verifiable JWT', async () => {
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    const decoded = jwt.decode(pair.refreshToken) as any
    expect(decoded).not.toBeNull()
    expect(decoded.sub).toBe(TEST_USER_ID)
    expect(decoded.type).toBe('refresh')
  })

  it('saves a SHA-256 hash of the refresh token to the DB (not the plaintext)', async () => {
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce()
    const { data } = prisma.refreshToken.create.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(data['tokenHash']).not.toBe(pair.refreshToken) // stored as hash, not plaintext
    expect(typeof data['tokenHash']).toBe('string')
    expect((data['tokenHash'] as string).length).toBe(64) // SHA-256 hex
    expect(data['userId']).toBe(TEST_USER_ID)
  })

  it('consecutive calls produce different token pairs', async () => {
    const first = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    const second = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    expect(first.accessToken).not.toBe(second.accessToken)
    expect(first.refreshToken).not.toBe(second.refreshToken)
  })
})

// ─────────────────────────────────────────────────────────────
// rotateTokens
// ─────────────────────────────────────────────────────────────
describe('TokenService.rotateTokens', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: TokenService
  let validRefreshToken: string

  beforeEach(async () => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new TokenService(prisma as any)

    // Create a real refresh token to use in tests
    prisma.refreshToken.create.mockResolvedValue({ id: TEST_TOKEN_ID })
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    validRefreshToken = pair.refreshToken

    // Default: token found in DB, not revoked, not expired, user active
    prisma.refreshToken.findUnique.mockResolvedValue(makeStoredToken())
    prisma.refreshToken.update.mockResolvedValue({})
    prisma.refreshToken.create.mockResolvedValue({ id: 'new-token-id' })
  })

  it('valid token returns a new token pair', async () => {
    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).not.toBeNull()
    expect(typeof result?.accessToken).toBe('string')
    expect(typeof result?.refreshToken).toBe('string')
  })

  it('valid token rotation revokes the old token', async () => {
    await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_TOKEN_ID },
        data: expect.objectContaining({ isRevoked: true, revokedReason: 'rotated' }),
      })
    )
  })

  it('invalid JWT string returns null and logs security event', async () => {
    const result = await service.rotateTokens('not.a.jwt.token.here', DEVICE_INFO)
    expect(result).toBeNull()
  })

  it('token not found in DB returns null', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null)
    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).toBeNull()
  })

  it('revoked token triggers revokeAllUserTokens (reuse detection)', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      makeStoredToken({ isRevoked: true })
    )
    prisma.refreshToken.findMany.mockResolvedValue([])
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 })

    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).toBeNull()
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER_ID, isRevoked: false }),
        data: expect.objectContaining({ isRevoked: true, revokedReason: 'token_reuse_detected' }),
      })
    )
  })

  it('expired token returns null', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      makeStoredToken({ expiresAt: PAST_EXPIRES })
    )
    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).toBeNull()
  })

  it('inactive user (status != active) returns null', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      makeStoredToken({
        user: { id: TEST_USER_ID, role: TEST_ROLE, status: 'blocked', deletedAt: null },
      })
    )
    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).toBeNull()
  })

  it('deleted user (deletedAt set) returns null', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      makeStoredToken({
        user: {
          id: TEST_USER_ID,
          role: TEST_ROLE,
          status: 'active',
          deletedAt: new Date(Date.now() - 10000),
        },
      })
    )
    const result = await service.rotateTokens(validRefreshToken, DEVICE_INFO)
    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// revokeToken
// ─────────────────────────────────────────────────────────────
describe('TokenService.revokeToken', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: TokenService
  let validRefreshToken: string

  beforeEach(async () => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new TokenService(prisma as any)

    prisma.refreshToken.create.mockResolvedValue({ id: TEST_TOKEN_ID })
    const pair = await service.createTokenPair(TEST_USER_ID, TEST_ROLE, DEVICE_INFO)
    validRefreshToken = pair.refreshToken
  })

  it('marks token as revoked in DB', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: TEST_TOKEN_ID,
      expiresAt: FUTURE_EXPIRES,
    })
    prisma.refreshToken.update.mockResolvedValue({})

    await service.revokeToken(validRefreshToken, TEST_USER_ID)

    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_TOKEN_ID },
        data: expect.objectContaining({ isRevoked: true, revokedReason: 'logout' }),
      })
    )
  })

  it('adds token to Redis blacklist with TTL', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue({
      id: TEST_TOKEN_ID,
      expiresAt: FUTURE_EXPIRES,
    })
    prisma.refreshToken.update.mockResolvedValue({})

    await service.revokeToken(validRefreshToken, TEST_USER_ID)

    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining('token:blacklist:'),
      expect.any(Number),
      '1'
    )
  })

  it('does not throw when token is not found (idempotent)', async () => {
    prisma.refreshToken.findFirst.mockResolvedValue(null)
    await expect(service.revokeToken(validRefreshToken, TEST_USER_ID)).resolves.toBeUndefined()
    expect(prisma.refreshToken.update).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// revokeAllUserTokens
// ─────────────────────────────────────────────────────────────
describe('TokenService.revokeAllUserTokens', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: TokenService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new TokenService(prisma as any)
    mockRedisPipeline.mockReturnValue(mockPipeline)
    mockPipeline.exec.mockResolvedValue([])
  })

  it('revokes all non-revoked tokens for the user in DB', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      { id: 'tok-1', expiresAt: FUTURE_EXPIRES },
      { id: 'tok-2', expiresAt: FUTURE_EXPIRES },
    ])
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })

    await service.revokeAllUserTokens(TEST_USER_ID, 'test_reason')

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER_ID, isRevoked: false },
        data: expect.objectContaining({ isRevoked: true, revokedReason: 'test_reason' }),
      })
    )
  })

  it('adds all tokens to Redis blacklist via pipeline', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      { id: 'tok-1', expiresAt: FUTURE_EXPIRES },
      { id: 'tok-2', expiresAt: FUTURE_EXPIRES },
    ])
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 })

    await service.revokeAllUserTokens(TEST_USER_ID, 'compromise')

    expect(mockRedisPipeline).toHaveBeenCalledOnce()
    expect(mockPipeline.setex).toHaveBeenCalledTimes(2)
    expect(mockPipeline.exec).toHaveBeenCalledOnce()
  })

  it('works correctly when user has no active tokens', async () => {
    prisma.refreshToken.findMany.mockResolvedValue([])
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      service.revokeAllUserTokens(TEST_USER_ID, 'empty')
    ).resolves.toBeUndefined()
    expect(mockPipeline.setex).not.toHaveBeenCalled()
  })
})

// ─────────────────────────────────────────────────────────────
// cleanupExpiredTokens
// ─────────────────────────────────────────────────────────────
describe('TokenService.cleanupExpiredTokens', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: TokenService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new TokenService(prisma as any)
  })

  it('deletes expired and old-revoked tokens and returns the count', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 42 })
    const count = await service.cleanupExpiredTokens()
    expect(count).toBe(42)
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledOnce()
  })

  it('passes OR condition with expiry and revocation clauses', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 })
    await service.cleanupExpiredTokens()
    const { where } = prisma.refreshToken.deleteMany.mock.calls[0]![0] as { where: Record<string, unknown> }
    expect(where).toHaveProperty('OR')
    expect((where['OR'] as unknown[]).length).toBe(2)
  })

  it('returns 0 when nothing to clean', async () => {
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 })
    const count = await service.cleanupExpiredTokens()
    expect(count).toBe(0)
  })
})
