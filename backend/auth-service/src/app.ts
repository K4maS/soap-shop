import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { PrismaClient } from '@prisma/client';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { redis } from './utils/redis.js';
import { createAuthRouter } from './routes/auth.routes.js';
import {
  errorHandler,
  AppError,
} from './middleware/error.middleware.js';
import {
  requestIdMiddleware,
  securityLoggerMiddleware,
  getCorsOptions,
} from './middleware/security.middleware.js';

// =============================================================
// Auth Service — Express Application
// =============================================================

const prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

const app = express();

// ─── Trust proxy (Nginx) ──────────────────────────────────
// SECURITY: устанавливаем кол-во trusted proxies явно
app.set('trust proxy', 1);

// ─── Security headers ─────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
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
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  })
);

// ─── CORS ─────────────────────────────────────────────────
const allowedOrigins = config.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(cors(getCorsOptions(allowedOrigins)));

// ─── Request parsing ──────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Ограничиваем размер body
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// ─── Request ID ───────────────────────────────────────────
app.use(requestIdMiddleware);

// ─── Structured logging ───────────────────────────────────
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    customLogLevel(_req, res) {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// ─── Security logging ─────────────────────────────────────
app.use(securityLoggerMiddleware);

// ─── Health check ─────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ok', service: 'auth-service' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'error' });
  }
});

// ─── Routes ───────────────────────────────────────────────
app.use('/api/v1/auth', createAuthRouter(prisma));

// ─── 404 handler ──────────────────────────────────────────
app.use((_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found'));
});

// ─── Error handler ────────────────────────────────────────
app.use(errorHandler);

// ─── Graceful shutdown ────────────────────────────────────
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down gracefully...');

  await Promise.allSettled([
    prisma.$disconnect(),
    redis.quit(),
  ]);

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

// ─── Start server ─────────────────────────────────────────
const server = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    'Auth service started'
  );
});

server.on('error', (err) => {
  logger.error({ err }, 'Server error');
  process.exit(1);
});

export { app };
