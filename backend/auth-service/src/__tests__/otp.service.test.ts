import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ─── Mock redis module ─────────────────────────────────────────
vi.mock('../utils/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    ttl: vi.fn(),
    pipeline: vi.fn(() => ({ setex: vi.fn(), exec: vi.fn() })),
  },
  checkRateLimit: vi.fn(),
  otpRateByPhone: vi.fn((h: string) => `otp:rate:phone:${h}`),
  otpRateByIp: vi.fn((ip: string) => `otp:rate:ip:${ip}`),
  otpBlock: vi.fn((id: string) => `otp:block:${id}`),
}))

// ─── Mock crypto utilities ─────────────────────────────────────
vi.mock('../utils/crypto.js', () => ({
  generateOtp: vi.fn(() => '123456'),
  hashSecret: vi.fn(async () => '$argon2id$v=19$m=65536,t=3,p=4$fakehash'),
  verifySecret: vi.fn(async () => true),
  hashForSearch: vi.fn((v: string) => `hash:${v}`),
  encrypt: vi.fn((v: string) => `enc:${v}`),
}))

// ─── Mock SMS service ──────────────────────────────────────────
vi.mock('../services/sms.service.js', () => ({
  SmsService: vi.fn().mockImplementation(() => ({
    sendOtp: vi.fn(async () => undefined),
  })),
}))

import { OtpService } from '../services/otp.service.js'
import { SmsService } from '../services/sms.service.js'
import { redis, checkRateLimit } from '../utils/redis.js'
import { verifySecret } from '../utils/crypto.js'
import { OtpPurpose } from '@prisma/client'

// ─── Typed mock helpers ────────────────────────────────────────
const mockRedisGet = redis.get as Mock
const mockRedisSetex = redis.setex as Mock
const mockRedisTtl = (redis as any).ttl as Mock
const mockCheckRateLimit = checkRateLimit as Mock
const mockVerifySecret = verifySecret as Mock

// ─── Shared mock Prisma client factory ────────────────────────
function buildMockPrisma() {
  return {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    otpCode: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
}

const TEST_PHONE = '+79991234567'
const TEST_IP = '127.0.0.1'
const TEST_UA = 'vitest/1.0'
const TEST_USER_ID = 'user-uuid-1234'
const TEST_OTP_ID = 'otp-uuid-5678'

// ─── Helpers for frequently reused mock objects ────────────────
function makeActiveUser(overrides: Partial<{ blockedUntil: Date | null; status: string }> = {}) {
  return {
    id: TEST_USER_ID,
    status: 'active',
    blockedUntil: null,
    ...overrides,
  }
}

function makeActiveOtpRecord(overrides: Partial<{
  id: string
  attempts: number
  codeHash: string
  isUsed: boolean
  isBlocked: boolean
}> = {}) {
  return {
    id: TEST_OTP_ID,
    attempts: 0,
    codeHash: '$argon2id$v=19$m=65536,t=3,p=4$fakehash',
    isUsed: false,
    isBlocked: false,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// requestOtp
// ─────────────────────────────────────────────────────────────
describe('OtpService.requestOtp', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let smsService: SmsService
  let service: OtpService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    smsService = new SmsService()
    service = new OtpService(prisma as any, smsService)

    // Default: both rate limits pass
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4 })

    // Default: existing user found, not blocked
    prisma.user.findFirst.mockResolvedValue(makeActiveUser())

    // Default: no errors in side-effect calls
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 })
    prisma.otpCode.create.mockResolvedValue({ id: TEST_OTP_ID })
  })

  it('returns { success: true } when all checks pass', async () => {
    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(result).toEqual({ success: true })
    expect(smsService.sendOtp).toHaveBeenCalledWith(TEST_PHONE, '123456')
  })

  it('rate limit by IP returns { success: false, retryAfter }', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 3540 })

    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(result).toEqual({ success: false, retryAfter: 3540 })
    expect(smsService.sendOtp).not.toHaveBeenCalled()
  })

  it('rate limit by phone (1 per 60s) returns { success: false }', async () => {
    // First call (IP check) passes, second (phone check) fails
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, remaining: 4 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfter: 55 })

    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(result.success).toBe(false)
    expect(smsService.sendOtp).not.toHaveBeenCalled()
  })

  it('blocked user (blockedUntil in the future) returns { success: false, retryAfter }', async () => {
    const blockedUntil = new Date(Date.now() + 900_000) // 15 minutes from now
    prisma.user.findFirst.mockResolvedValue(makeActiveUser({ blockedUntil }))

    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(result.success).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
    expect(smsService.sendOtp).not.toHaveBeenCalled()
  })

  it('creates a new user when phone not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null)
    prisma.user.create.mockResolvedValue(makeActiveUser())

    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(result.success).toBe(true)
    expect(prisma.user.create).toHaveBeenCalledOnce()
  })

  it('invalidates old OTP codes before creating a new one', async () => {
    await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER_ID, isUsed: false }),
        data: { isUsed: true },
      })
    )
  })

  it('uses default purpose OtpPurpose.login when not specified', async () => {
    await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: OtpPurpose.login }),
      })
    )
  })

  it('does not throw when SMS sending fails in non-production env', async () => {
    ;(smsService.sendOtp as Mock).mockRejectedValue(new Error('SMS provider down'))
    const result = await service.requestOtp(TEST_PHONE, TEST_IP, TEST_UA)
    // In test (non-production) env, error is swallowed
    expect(result.success).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// verifyOtp
// ─────────────────────────────────────────────────────────────
describe('OtpService.verifyOtp', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let smsService: SmsService
  let service: OtpService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    smsService = new SmsService()
    service = new OtpService(prisma as any, smsService)

    // Default: user found and not blocked in Redis
    prisma.user.findFirst.mockResolvedValue(makeActiveUser())
    mockRedisGet.mockResolvedValue(null) // no Redis block
    mockRedisTtl?.mockResolvedValue(-1)

    // Default: valid OTP record exists
    prisma.otpCode.findFirst.mockResolvedValue(makeActiveOtpRecord())
    prisma.otpCode.update.mockResolvedValue({})
    prisma.user.update.mockResolvedValue({})

    // Default: OTP hash verification passes
    mockVerifySecret.mockResolvedValue(true)
  })

  it('correct OTP returns { success: true, userId }', async () => {
    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(result).toEqual({ success: true, userId: TEST_USER_ID })
  })

  it('marks OTP as used after successful verification', async () => {
    await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_OTP_ID },
        data: { isUsed: true },
      })
    )
  })

  it('updates user login metadata on success', async () => {
    await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_USER_ID },
        data: expect.objectContaining({ status: 'active', failedLogins: 0 }),
      })
    )
  })

  it('wrong OTP returns { success: false, error: INVALID_OTP }', async () => {
    mockVerifySecret.mockResolvedValue(false)
    const result = await service.verifyOtp(TEST_PHONE, '000000', TEST_IP, TEST_UA)
    expect(result).toMatchObject({ success: false, error: 'INVALID_OTP' })
  })

  it('expired / non-existent OTP record returns { success: false, error: OTP_NOT_FOUND }', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(null)
    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(result).toMatchObject({ success: false, error: 'OTP_NOT_FOUND' })
  })

  it('unknown phone returns { success: false, error: INVALID_OTP } without leaking existence', async () => {
    prisma.user.findFirst.mockResolvedValue(null)
    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    // Must NOT return OTP_NOT_FOUND — that would reveal the phone does not exist
    expect(result).toMatchObject({ success: false, error: 'INVALID_OTP' })
  })

  it('OTP already used (isUsed: true) returns OTP_NOT_FOUND (query excludes it)', async () => {
    // The query itself filters out used OTPs, so findFirst returns null
    prisma.otpCode.findFirst.mockResolvedValue(null)
    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(result).toMatchObject({ success: false, error: 'OTP_NOT_FOUND' })
  })

  it('max attempts already reached (attempts >= OTP_MAX_ATTEMPTS) blocks account and returns MAX_ATTEMPTS_EXCEEDED', async () => {
    prisma.otpCode.findFirst.mockResolvedValue(
      makeActiveOtpRecord({ attempts: 3 }) // equal to OTP_MAX_ATTEMPTS=3
    )
    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA)
    expect(result).toMatchObject({ success: false, error: 'MAX_ATTEMPTS_EXCEEDED' })
    // Should have written a Redis block key
    expect(mockRedisSetex).toHaveBeenCalledWith(
      expect.stringContaining('otp:block:'),
      expect.any(Number),
      '1'
    )
  })

  it('wrong OTP on 3rd attempt blocks the account', async () => {
    // attempts is 2 currently; after increment it would equal OTP_MAX_ATTEMPTS=3
    prisma.otpCode.findFirst.mockResolvedValue(
      makeActiveOtpRecord({ attempts: 2 })
    )
    mockVerifySecret.mockResolvedValue(false)

    const result = await service.verifyOtp(TEST_PHONE, '000000', TEST_IP, TEST_UA)
    expect(result).toMatchObject({ success: false, error: 'MAX_ATTEMPTS_EXCEEDED' })
    expect(mockRedisSetex).toHaveBeenCalled()
  })

  it('Redis-blocked user returns { success: false, error: ACCOUNT_BLOCKED }', async () => {
    mockRedisGet.mockResolvedValue('1') // block key exists
    mockRedisTtl?.mockResolvedValue(800)

    const result = await service.verifyOtp(TEST_PHONE, '123456', TEST_IP, TEST_UA) as any
    expect(result.success).toBe(false)
    expect(result.error).toBe('ACCOUNT_BLOCKED')
  })
})
