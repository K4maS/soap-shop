import crypto from 'crypto';
import { config } from '../config/index.js';

// =============================================================
// Crypto utilities — AES-256-GCM encryption, HMAC search hashing
// All functions are synchronous (no I/O).
// =============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;       // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

/**
 * Derives the 32-byte AES key from the Base64-encoded env var.
 * Called lazily to allow unit tests to override process.env before import.
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = config.ENCRYPTION_KEY;
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
        'Generate with: openssl rand -base64 32'
    );
  }
  return key;
}

/**
 * Encrypts plaintext with AES-256-GCM.
 *
 * Output format (all hex, colon-delimited):
 *   "<iv>:<authTag>:<ciphertext>"
 *
 * Security: GCM provides authenticated encryption — any tampering with the
 * ciphertext, IV, or auth tag will cause decryption to throw.
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a value produced by {@link encrypt}.
 *
 * Throws on:
 *   - malformed input (wrong number of segments)
 *   - authentication failure (tampered data)
 *   - wrong key
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted data format: expected 3 colon-separated segments, ` +
        `got ${parts.length}`
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if auth tag doesn't match
  ]);

  return decrypted.toString('utf8');
}

/**
 * Deterministic HMAC-SHA256 hash used for searchable encrypted fields
 * (e.g. phone number lookup without storing the plaintext).
 *
 * The ENCRYPTION_KEY acts as the HMAC secret, protecting against
 * rainbow-table attacks even for low-entropy inputs like phone numbers.
 *
 * Security: the output is deterministic — given the same input and key
 * the result is always identical, enabling database equality lookups.
 */
export function hashForSearch(value: string): string {
  const key = config.ENCRYPTION_KEY.slice(0, 16); // 16-char slice as HMAC key
  return crypto
    .createHmac('sha256', key)
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * One-way SHA-256 hash of a token.
 * Used to store a non-reversible fingerprint of JWTs / refresh tokens in the DB
 * so that the raw token is never persisted at rest.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
