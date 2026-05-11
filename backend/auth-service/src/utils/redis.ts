import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// =============================================================
// Redis client — rate limiting, OTP state, session blacklist
// =============================================================

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 10) {
      logger.error('Redis: max retry attempts reached');
      return null;
    }
    return Math.min(times * 200, 5000);
  },
  lazyConnect: false,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  commandTimeout: 3000,
  // Security: отключаем небезопасные команды
  keyPrefix: 'mylo:auth:',
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

// ─── Redis key helpers ──────────────────────────────────────

/** OTP rate limit по номеру телефона */
export const otpRateByPhone = (phoneHash: string) =>
  `otp:rate:phone:${phoneHash}`;

/** OTP rate limit по IP */
export const otpRateByIp = (ip: string) => `otp:rate:ip:${ip}`;

/** OTP block — пользователь заблокирован после max attempts */
export const otpBlock = (userId: string) => `otp:block:${userId}`;

/** Refresh token blacklist (после logout/revoke) */
export const tokenBlacklist = (jti: string) => `token:blacklist:${jti}`;

/** User session data */
export const userSession = (userId: string) => `session:${userId}`;

// ─── Rate limiting helpers ─────────────────────────────────

/**
 * Инкрементирует счётчик с TTL
 * Возвращает текущее значение счётчика
 */
export async function incrementWithTtl(
  key: string,
  ttlSeconds: number
): Promise<number> {
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds);
  const results = await pipeline.exec();

  const incrResult = results?.[0];
  if (!incrResult || incrResult[0]) {
    throw new Error('Redis pipeline failed');
  }

  return incrResult[1] as number;
}

/**
 * Проверяет и инкрементирует rate limit
 * Returns: { allowed: boolean, remaining: number, retryAfter?: number }
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
  const current = await incrementWithTtl(key, windowSeconds);
  const ttl = await redis.ttl(key);

  if (current > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  }

  return {
    allowed: true,
    remaining: limit - current,
  };
}
