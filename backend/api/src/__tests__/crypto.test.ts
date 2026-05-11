import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, hashForSearch, hashToken } from '../utils/crypto.js'

// ─────────────────────────────────────────────────────────────
// encrypt / decrypt
// ─────────────────────────────────────────────────────────────
describe('encrypt / decrypt', () => {
  it('round-trips ASCII plaintext', () => {
    const text = 'hello world'
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('round-trips unicode and special characters', () => {
    const text = '🛒 Привет мир! @#$%^&*()'
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('round-trips empty string', () => {
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('round-trips a long payload', () => {
    const text = 'a'.repeat(10_000)
    expect(decrypt(encrypt(text))).toBe(text)
  })

  it('produces different ciphertexts on each call (random IV)', () => {
    const c1 = encrypt('same input')
    const c2 = encrypt('same input')
    expect(c1).not.toBe(c2)
  })

  it('output has exactly three colon-separated hex segments', () => {
    const parts = encrypt('test').split(':')
    expect(parts).toHaveLength(3)
    for (const part of parts) {
      expect(part).toMatch(/^[0-9a-f]+$/)
    }
  })

  it('IV segment is 32 hex chars (16 bytes)', () => {
    const [iv] = encrypt('test').split(':')
    expect(iv).toHaveLength(32)
  })

  it('auth-tag segment is 32 hex chars (16 bytes)', () => {
    const [, tag] = encrypt('test').split(':')
    expect(tag).toHaveLength(32)
  })
})

describe('decrypt — error cases', () => {
  it('throws on missing segments (no colons)', () => {
    expect(() => decrypt('baddata')).toThrow('Invalid encrypted data format')
  })

  it('throws on two segments instead of three', () => {
    expect(() => decrypt('aabb:ccdd')).toThrow('Invalid encrypted data format')
  })

  it('throws on four segments', () => {
    expect(() => decrypt('a:b:c:d')).toThrow('Invalid encrypted data format')
  })

  it('throws when ciphertext is tampered (GCM auth-tag mismatch)', () => {
    const encrypted = encrypt('secret value')
    const [iv, tag, ct] = encrypted.split(':') as [string, string, string]
    // Flip the first byte of the ciphertext
    const tampered = `${iv}:${tag}:${'00' + ct.slice(2)}`
    expect(() => decrypt(tampered)).toThrow()
  })

  it('throws when auth tag is tampered', () => {
    const encrypted = encrypt('secret value')
    const [iv, , ct] = encrypted.split(':') as [string, string, string]
    const fakeTag = '0'.repeat(32)
    expect(() => decrypt(`${iv}:${fakeTag}:${ct}`)).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────
// hashForSearch
// ─────────────────────────────────────────────────────────────
describe('hashForSearch', () => {
  it('returns a 64-char lowercase hex string', () => {
    expect(hashForSearch('+79991234567')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    expect(hashForSearch('test@example.com')).toBe(hashForSearch('test@example.com'))
  })

  it('normalises to lowercase before hashing', () => {
    expect(hashForSearch('FOO@BAR.COM')).toBe(hashForSearch('foo@bar.com'))
  })

  it('trims whitespace before hashing', () => {
    expect(hashForSearch('  foo  ')).toBe(hashForSearch('foo'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashForSearch('+79991111111')).not.toBe(hashForSearch('+79992222222'))
  })
})

// ─────────────────────────────────────────────────────────────
// hashToken
// ─────────────────────────────────────────────────────────────
describe('hashToken', () => {
  it('returns a 64-char lowercase hex string', () => {
    expect(hashToken('sometoken')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    expect(hashToken('jwt-token-abc')).toBe(hashToken('jwt-token-abc'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hashToken('tokenA')).not.toBe(hashToken('tokenB'))
  })

  it('handles an empty string', () => {
    expect(hashToken('')).toMatch(/^[0-9a-f]{64}$/)
  })
})
