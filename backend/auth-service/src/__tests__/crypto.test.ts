import { describe, it, expect, vi } from 'vitest'

// ─── Mock Redis before any module that touches it loads ────────
vi.mock('../utils/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    pipeline: vi.fn(() => ({ setex: vi.fn(), exec: vi.fn() })),
  },
  checkRateLimit: vi.fn(),
  otpRateByPhone: vi.fn((h: string) => `otp:rate:phone:${h}`),
  otpRateByIp: vi.fn((ip: string) => `otp:rate:ip:${ip}`),
  otpBlock: vi.fn((id: string) => `otp:block:${id}`),
  tokenBlacklist: vi.fn((jti: string) => `token:blacklist:${jti}`),
}))

import {
  encrypt,
  decrypt,
  hashForSearch,
  hashToken,
  generateOtp,
  hashSecret,
  verifySecret,
  timingSafeEqual,
  generateSecureToken,
} from '../utils/crypto.js'

// ─────────────────────────────────────────────────────────────
// encrypt / decrypt
// ─────────────────────────────────────────────────────────────
describe('encrypt / decrypt', () => {
  it('roundtrip returns the original string', () => {
    const plaintext = 'Hello, World! +79991234567'
    const ciphertext = encrypt(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it('encrypts unicode text correctly', () => {
    const plaintext = 'Привет мир 🔐'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('different calls produce different ciphertext (random IV)', () => {
    const plaintext = 'same-input'
    const first = encrypt(plaintext)
    const second = encrypt(plaintext)
    expect(first).not.toBe(second)
  })

  it('ciphertext has the iv:authTag:ciphertext format (3 colon-separated parts)', () => {
    const result = encrypt('test')
    const parts = result.split(':')
    expect(parts).toHaveLength(3)
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32)
    // authTag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32)
    // ciphertext is at least 1 byte = 2 hex chars
    expect((parts[2] as string).length).toBeGreaterThanOrEqual(2)
  })

  it('decrypt with tampered authTag throws an error', () => {
    const ciphertext = encrypt('secret')
    const parts = ciphertext.split(':')
    // Flip one character in the auth tag
    const tamperedTag = parts[1]!.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
    const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`
    expect(() => decrypt(tampered)).toThrow()
  })

  it('decrypt with tampered ciphertext body throws an error', () => {
    const ciphertext = encrypt('secret')
    const parts = ciphertext.split(':')
    const tamperedBody = parts[2]!.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))
    const tampered = `${parts[0]}:${parts[1]}:${tamperedBody}`
    expect(() => decrypt(tampered)).toThrow()
  })

  it('decrypt throws on invalid format (missing parts)', () => {
    expect(() => decrypt('onlytwoparts:here')).toThrow('Invalid encrypted data format')
  })

  it('decrypt throws on empty string', () => {
    expect(() => decrypt('')).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────
// hashForSearch
// ─────────────────────────────────────────────────────────────
describe('hashForSearch', () => {
  it('same input always produces the same output (deterministic)', () => {
    const first = hashForSearch('+79991234567')
    const second = hashForSearch('+79991234567')
    expect(first).toBe(second)
  })

  it('normalises input (lowercases and trims before hashing)', () => {
    expect(hashForSearch('Test@Example.com')).toBe(hashForSearch('test@example.com'))
    expect(hashForSearch('  hello  ')).toBe(hashForSearch('hello'))
  })

  it('different inputs produce different hashes', () => {
    expect(hashForSearch('+79991234567')).not.toBe(hashForSearch('+79997654321'))
  })

  it('returns a 64-char lowercase hex string', () => {
    const hash = hashForSearch('value')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ─────────────────────────────────────────────────────────────
// hashToken
// ─────────────────────────────────────────────────────────────
describe('hashToken', () => {
  it('returns a consistent SHA-256 hex string', () => {
    const token = 'my-refresh-token-value'
    expect(hashToken(token)).toBe(hashToken(token))
  })

  it('returns a 64-char lowercase hex string', () => {
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('different tokens produce different hashes', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'))
  })
})

// ─────────────────────────────────────────────────────────────
// generateOtp
// ─────────────────────────────────────────────────────────────
describe('generateOtp', () => {
  it('returns a 6-digit string', () => {
    const otp = generateOtp()
    expect(otp).toMatch(/^\d{6}$/)
  })

  it('returns a value in the range [100000, 999999]', () => {
    for (let i = 0; i < 20; i++) {
      const code = parseInt(generateOtp(), 10)
      expect(code).toBeGreaterThanOrEqual(100000)
      expect(code).toBeLessThanOrEqual(999999)
    }
  })

  it('different calls return different codes (probabilistic)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtp()))
    // With 20 draws from 900000 possibilities, collision probability is negligible
    expect(codes.size).toBeGreaterThan(1)
  })
})

// ─────────────────────────────────────────────────────────────
// hashSecret / verifySecret  (argon2id — slow; use sparingly)
// ─────────────────────────────────────────────────────────────
describe('hashSecret / verifySecret', () => {
  it('roundtrip: verifySecret returns true for the original secret', async () => {
    const secret = '123456'
    const hash = await hashSecret(secret)
    expect(await verifySecret(hash, secret)).toBe(true)
  }, 15_000)

  it('verifySecret returns false for a wrong secret', async () => {
    const secret = '123456'
    const hash = await hashSecret(secret)
    expect(await verifySecret(hash, '654321')).toBe(false)
  }, 15_000)

  it('two hashes of the same secret are NOT equal (random salt)', async () => {
    const secret = 'same-secret'
    const hash1 = await hashSecret(secret)
    const hash2 = await hashSecret(secret)
    expect(hash1).not.toBe(hash2)
  }, 15_000)

  it('verifySecret returns false for a completely invalid hash string', async () => {
    expect(await verifySecret('not-a-valid-hash', 'anything')).toBe(false)
  }, 15_000)
})

// ─────────────────────────────────────────────────────────────
// timingSafeEqual
// ─────────────────────────────────────────────────────────────
describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('hello', 'hello')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(timingSafeEqual('abcde', 'abcdf')).toBe(false)
  })

  it('returns false for strings of different length', () => {
    expect(timingSafeEqual('short', 'longer')).toBe(false)
  })

  it('works correctly for empty strings', () => {
    expect(timingSafeEqual('', '')).toBe(true)
    expect(timingSafeEqual('', 'x')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// generateSecureToken
// ─────────────────────────────────────────────────────────────
describe('generateSecureToken', () => {
  it('returns a non-empty base64url string', () => {
    const token = generateSecureToken()
    expect(token.length).toBeGreaterThan(0)
    // base64url charset
    expect(token).toMatch(/^[A-Za-z0-9_-]+=*$/)
  })

  it('different calls return different tokens', () => {
    const tokens = new Set(Array.from({ length: 10 }, () => generateSecureToken(32)))
    expect(tokens.size).toBeGreaterThan(1)
  })

  it('length scales with requested byte count', () => {
    const short = generateSecureToken(8)
    const long = generateSecureToken(64)
    expect(long.length).toBeGreaterThan(short.length)
  })
})
