import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../utils/redis.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// =============================================================
// Rate limiting middleware — Redis-backed
//
// Security: Redis store ensures limits work across
// multiple instances (horizontal scaling)
// =============================================================

function createRedisStore(prefix: string) {
  return new RedisStore({
    // @ts-expect-error — ioredis compatible interface
    sendCommand: (...args: string[]) => redis.call(...args),
    prefix: `mylo:rl:${prefix}:`,
  });
}

/**
 * Global rate limit — все запросы
 */
export const globalRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('global'),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, res) => {
    logger.warn({ ip: _req.ip }, 'Global rate limit exceeded');
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    });
  },
});

/**
 * Strict rate limit для API эндпоинтов
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('api'),
  keyGenerator: (req) => `${req.ip}:${req.user?.id ?? 'anon'}`,
});

/**
 * Строгий rate limit для создания заказов — антифрод
 */
export const orderRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // 10 заказов в час
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('order'),
  keyGenerator: (req) => req.ip ?? 'unknown',
  handler: (_req, res) => {
    logger.warn({ ip: _req.ip }, 'Order rate limit exceeded');
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many orders. Please try again later.',
      },
    });
  },
});
