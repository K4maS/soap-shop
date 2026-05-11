import crypto from 'crypto';
import * as argon2 from 'argon2';
import { config } from '../config/index.js';

// =============================================================
// Crypto utilities — production-grade security primitives
// =============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Получает 32-байтный ключ из конфига (Base64 → Buffer)
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = config.ENCRYPTION_KEY;
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (base64 encoded)');
  }
  return key;
}

/**
 * AES-256-GCM шифрование
 * Формат результата: "iv:authTag:ciphertext" (все в hex)
 *
 * Security: GCM обеспечивает authenticated encryption —
 * нельзя изменить шифротекст без обнаружения
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

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * AES-256-GCM дешифрование
 * Security: бросает исключение при нарушении целостности данных
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
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
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * SHA-256 хэш для поиска (deterministic)
 * Используется для phoneHash и emailHash
 * Security: добавляем соль из env для защиты от rainbow tables
 */
export function hashForSearch(value: string): string {
  const salt = config.ENCRYPTION_KEY.slice(0, 16);
  return crypto
    .createHmac('sha256', salt)
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * SHA-256 хэш для токенов (для хранения в БД)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Генерация OTP: 6-значный цифровой код
 * Security: crypto.randomInt для криптографически безопасной случайности
 */
export function generateOtp(): string {
  const code = crypto.randomInt(100000, 999999);
  return code.toString();
}

/**
 * Argon2id хэш для OTP и паролей
 * Security: argon2id рекомендован OWASP для хэширования паролей
 */
export async function hashSecret(secret: string): Promise<string> {
  return argon2.hash(secret, {
    type: argon2.argon2id,
    memoryCost: 65536,    // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Верификация argon2id хэша
 * Security: constant-time comparison встроена в argon2.verify
 */
export async function verifySecret(hash: string, secret: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, secret);
  } catch {
    return false;
  }
}

/**
 * Constant-time string comparison для защиты от timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Всё равно выполняем сравнение чтобы не раскрыть длину
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Генерация cryptographically secure random token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
