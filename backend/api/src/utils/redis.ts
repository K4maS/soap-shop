import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// =============================================================
// Redis client — caching, rate limiting, token blacklist
// keyPrefix: 'mylo:api:' scopes all keys to the api service
// =============================================================

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  keyPrefix: 'mylo:api:',
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 10) {
      logger.error('Redis: max retry attempts reached, giving up');
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn({ times, delay }, 'Redis: retrying connection');
    return delay;
  },
  lazyConnect: true,
  enableOfflineQueue: true,
  connectTimeout: 5000,
  commandTimeout: 3000,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('ready', () => logger.info('Redis ready'));
redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));
redis.on('reconnecting', () => logger.warn('Redis reconnecting'));
redis.on('close', () => logger.warn('Redis connection closed'));

// ─── Key helpers ───────────────────────────────────────────

/**
 * Key for access token JTI blacklist (revoked tokens)
 * Security: tokens go here on logout / key rotation
 */
export const tokenBlacklist = (jti: string): string =>
  `token:blacklist:${jti}`;

/**
 * Key for cached product data
 */
export const productCache = (id: string): string =>
  `product:${id}`;

/**
 * Key for cached product list (by query hash)
 */
export const productListCache = (queryHash: string): string =>
  `product:list:${queryHash}`;

/**
 * Key for cached categories list
 */
export const categoriesCache = (): string => `categories:all`;

/**
 * Key for session metadata (last activity, device info)
 */
export const sessionKey = (userId: string): string =>
  `session:${userId}`;

/**
 * Key for cart data stored in Redis
 */
export const cartKey = (userId: string): string =>
  `cart:${userId}`;

/**
 * Key for general rate limiting by identifier
 */
export const rateLimitKey = (prefix: string, identifier: string): string =>
  `ratelimit:${prefix}:${identifier}`;

// ─── Rate limiting helpers ─────────────────────────────────

/**
 * Increments a counter with TTL (set on first increment).
 * Subsequent calls within the window do not reset the TTL.
 * Returns the current counter value after increment.
 */
export async function incrementWithTtl(
  key: string,
  ttlSeconds: number
): Promise<number> {
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, ttlSeconds, 'NX'); // NX = only set if not already exists
  const results = await pipeline.exec();

  const incrResult = results?.[0];
  if (!incrResult || incrResult[0] !== null) {
    throw new Error('Redis pipeline failed during incrementWithTtl');
  }

  return incrResult[1] as number;
}

/**
 * Checks and increments a sliding-window rate limit counter.
 * Returns whether the request is allowed and remaining capacity.
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

/**
 * Stores a value in Redis with optional TTL.
 * Used for caching product/category data.
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

/**
 * Retrieves a cached value, returns null on miss.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Deletes one or more cache keys (e.g. after a product update).
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys);
}
