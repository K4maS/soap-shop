import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { redis } from './utils/redis.js';
import { errorHandler, AppError } from './middleware/error.middleware.js';
import { createProductsRouter } from './routes/products.routes.js';
import { createOrdersRouter } from './routes/orders.routes.js';
import { createCartRouter } from './routes/cart.routes.js';
import { createUploadRouter } from './routes/upload.routes.js';

// =============================================================
// Mylo Master — API Service  (port 3001)
// =============================================================

// ─── Prisma ───────────────────────────────────────────────────

const prisma = new PrismaClient({
  log:
    config.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' },
        ]
      : [{ emit: 'event', level: 'error' }],
});

if (config.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    logger.debug({ query: e.query, duration: e.duration }, 'DB query');
  });
}

(prisma as any).$on('error', (e: any) => {
  logger.error({ error: e }, 'Prisma error');
});

// ─── Express app ──────────────────────────────────────────────

const app = express();

// Security: limit trust to one upstream proxy (Nginx)
app.set('trust proxy', 1);

// ─── Security headers (Helmet) ────────────────────────────────

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 63_072_000, // 2 years
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// ─── CORS ─────────────────────────────────────────────────────

const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      if (!origin) {
        // Allow server-to-server and health checks
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS: blocked request');
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  })
);

// ─── Compression ──────────────────────────────────────────────

app.use(compression());

// ─── Request parsing ──────────────────────────────────────────

// Security: body size limit to prevent resource exhaustion
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// ─── Request ID ───────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-request-id'] as string | undefined;
  const requestId =
    incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming)
      ? incoming
      : uuidv4();

  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
});

// ─── Structured HTTP logging ──────────────────────────────────

app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    customLogLevel(_req: Request, res: Response) {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customProps(req: Request) {
      return { requestId: (req as any).requestId };
    },
    // Never log request/response bodies (contain PII)
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        remoteAddress: req.remoteAddress,
      }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

// ─── Global rate limiter (Redis-backed) ───────────────────────

const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  // Skip health check from rate limiting
  skip: (req: Request) => req.path === '/health',
  store: new RedisStore({
    // ioredis compatible sendCommand
    sendCommand: (...args: string[]) => (redis as any).call(...args),
  }),
  handler(_req: Request, res: Response) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests, please try again later',
      },
    });
  },
});

app.use(globalRateLimiter);

// ─── Health check ─────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [dbResult, redisPong] = await Promise.all([
      prisma.$queryRaw<[{ result: number }]>`SELECT 1 AS result`,
      redis.ping(),
    ]);

    res.status(200).json({
      status: 'ok',
      service: 'api',
      checks: {
        database: dbResult ? 'ok' : 'error',
        redis: redisPong === 'PONG' ? 'ok' : 'error',
      },
    });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({
      status: 'error',
      service: 'api',
    });
  }
});

// ─── API routes ───────────────────────────────────────────────

app.use('/api/v1/products', createProductsRouter(prisma));
app.use('/api/v1/orders', createOrdersRouter(prisma));
app.use('/api/v1/cart', createCartRouter(prisma));
app.use('/api/v1/admin/upload', createUploadRouter());

// ─── 404 handler ──────────────────────────────────────────────

app.use((_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found'));
});

// ─── Centralized error handler ────────────────────────────────

app.use(errorHandler);

// ─── Graceful shutdown ────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    logger.info('Connections closed — exiting');
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timeout — forcing exit');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

// ─── Start server ─────────────────────────────────────────────

const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    'API service started'
  );
});

server.on('error', (err) => {
  logger.error({ err }, 'Server startup error');
  process.exit(1);
});

export { app };
