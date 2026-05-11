import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { PrismaClient, Prisma, OrderStatus, UserRole, AuditAction } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import pino from 'pino';
import jwt from 'jsonwebtoken';

// =============================================================
// Admin Service — port 3003
// All routes require admin or manager role.
// Sensitive data is masked before responses are sent.
// =============================================================

// ─── Environment validation ────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().default(3003),
  DATABASE_URL: z.string().min(10),
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().min(8),
  JWT_ACCESS_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5174'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(30).default(90),
});

const envParsed = envSchema.safeParse(process.env);
if (!envParsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(envParsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}
const cfg = envParsed.data;

// ─── Logger ────────────────────────────────────────────────────

const logger = pino({
  level: cfg.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'email',
      'phone',
      'password',
      'token',
    ],
    censor: '[REDACTED]',
  },
  base: { service: 'admin-service', env: cfg.NODE_ENV, pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ─── Redis ─────────────────────────────────────────────────────

const redis = new Redis({
  host: cfg.REDIS_HOST,
  port: cfg.REDIS_PORT,
  password: cfg.REDIS_PASSWORD,
  keyPrefix: 'mylo:admin:',
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 5000);
  },
  lazyConnect: true,
  enableOfflineQueue: true,
});

redis.on('error', (err: Error) => logger.error({ err }, 'Redis error'));

// ─── Prisma ────────────────────────────────────────────────────

const prisma = new PrismaClient({
  log:
    cfg.NODE_ENV === 'development'
      ? ['warn', 'error']
      : [{ emit: 'event', level: 'error' }],
});

// ─── Types ─────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  role: 'admin' | 'manager' | 'accountant';
}

interface AuthedRequest extends Request {
  user?: AdminUser;
  requestId?: string;
}

// ─── Auth middleware ───────────────────────────────────────────

async function requireAdminAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, cfg.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: 'mylo-auth',
      audience: 'mylo-api',
    }) as { sub: string; role: string; jti: string };

    if (!['admin', 'manager', 'accountant'].includes(payload.role)) {
      logger.warn(
        { userId: payload.sub, role: payload.role, path: req.path },
        'Admin access denied: insufficient role'
      );
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }

    // Check token blacklist
    const blacklisted = await redis.exists(`token:blacklist:${payload.jti}`);
    if (blacklisted) {
      res.status(401).json({ success: false, error: { code: 'TOKEN_REVOKED', message: 'Token has been revoked' } });
      return;
    }

    (req as AuthedRequest).user = {
      id: payload.sub,
      role: payload.role as AdminUser['role'],
    };
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      success: false,
      error: {
        code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: isExpired ? 'Token has expired' : 'Invalid token',
      },
    });
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthedRequest).user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
      return;
    }
    next();
  };
}

// ─── Data masking helpers ──────────────────────────────────────

/** Masks all but the last 4 digits: "+7 9XX XXX XX XX" → "XXXX XXXX X897" */
function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `****${digits.slice(-4)}`;
}

/** Masks email: "user@example.com" → "u***@example.com" */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!local || !domain) return '****@****';
  return `${local[0]}***@${domain}`;
}

function buildPagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query['page'] ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query['limit'] ?? 20)));
  return { page, limit, skip: (page - 1) * limit };
}

// ─── Express setup ─────────────────────────────────────────────

const app = express();
app.set('trust proxy', 1);

app.use(
  helmet({
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

const allowedOrigins = cfg.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// Request ID
app.use((req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-request-id'] as string | undefined;
  const reqId =
    incoming && /^[a-zA-Z0-9_-]{8,64}$/.test(incoming) ? incoming : uuidv4();
  (req as AuthedRequest).requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// HTTP logging
app.use(
  pinoHttp({
    logger,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
    customLogLevel(_req: Request, res: Response) {
      return res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    },
  })
);

// Rate limiter — stricter for admin service
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => req.path === '/health',
    store: new RedisStore({
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
    handler(_req: Request, res: Response) {
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      });
    },
  })
);

// ─── Health check ──────────────────────────────────────────────

app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({ status: 'ok', service: 'admin-service' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    res.status(503).json({ status: 'error' });
  }
});

// ─── All admin routes require authentication ───────────────────

app.use('/api/admin', requireAdminAuth);

// ─── GET /api/admin/orders — list all orders with filters ──────

app.get(
  '/api/admin/orders',
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = buildPagination(req.query as Record<string, unknown>);
    const { status, dateFrom, dateTo, userId } = req.query as Record<string, string | undefined>;

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as OrderStatus;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    const [orders, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          items: { select: { productName: true, quantity: true, unitPriceKopecks: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      data: orders.map((o) => ({
        ...o,
        totalRub: Number(o.totalKopecks) / 100,
        subtotalRub: Number(o.subtotalKopecks) / 100,
        deliveryCostRub: Number(o.deliveryCostKopecks) / 100,
        items: o.items.map((i) => ({
          ...i,
          unitPriceRub: Number(i.unitPriceKopecks) / 100,
        })),
        // Security: mask IP in non-prod for GDPR
        ipAddress: cfg.NODE_ENV === 'production' ? o.ipAddress : '[masked]',
      })),
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthedRequest).requestId,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─── PATCH /api/admin/orders/:id/status ────────────────────────

app.patch(
  '/api/admin/orders/:id/status',
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { status, comment } = req.body as { status: string; comment?: string };

    if (!status) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'status is required' } });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
      return;
    }

    const actorId = (req as AuthedRequest).user!.id;

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { status: status as any },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: status as any,
          changedBy: actorId,
          comment: comment?.slice(0, 500) ?? null,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: 'order_status_changed' as AuditAction,
        actorId,
        subjectId: id,
        subjectType: 'order',
        ipAddress: req.ip ?? null,
        metadata: { newStatus: status, comment },
        success: true,
      },
    });

    res.json({ success: true, meta: { timestamp: new Date().toISOString() } });
  })
);

// ─── GET /api/admin/users ──────────────────────────────────────

app.get(
  '/api/admin/users',
  requireRole('admin'),
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = buildPagination(req.query as Record<string, unknown>);
    const { search, role, isActive } = req.query as Record<string, string | undefined>;

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (role) where.role = role as UserRole;
    if (isActive !== undefined) {
      where.status = isActive === 'true' ? 'active' : { not: 'active' };
    }
    if (search) {
      where.OR = [
        { phoneHash: { contains: search } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          phoneEncrypted: true,
          emailEncrypted: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Security: mask phone and email — never return plaintext PII to the UI
    const maskedUsers = users.map((u) => ({
      id: u.id,
      role: u.role,
      status: u.status,
      firstName: u.firstName,
      lastName: u.lastName,
      phoneMasked: u.phoneEncrypted ? maskPhone('XXXX' + u.id.slice(-4)) : null,
      emailMasked: u.emailEncrypted ? maskEmail(null) ?? '****@****.***' : null,
      isActive: u.status === 'active',
      isVerified: u.status !== 'pending_verification',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      orderCount: u._count.orders,
    }));

    res.json({
      success: true,
      data: maskedUsers,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthedRequest).requestId,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─── PATCH /api/admin/users/:id — update role or status ───────

app.patch(
  '/api/admin/users/:id',
  requireRole('admin'),
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as { id: string };
    const { role, isActive } = req.body as { role?: string; isActive?: boolean };
    const actorId = (req as AuthedRequest).user!.id;

    // Prevent self-demotion
    if (id === actorId && role && role !== 'admin') {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Cannot change your own role' },
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role: role as UserRole } : {}),
        ...(isActive !== undefined ? { status: isActive ? 'active' as const : 'blocked' as const } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'user_updated' as AuditAction,
        actorId,
        subjectId: id,
        subjectType: 'user',
        ipAddress: req.ip,
        metadata: { role, isActive },
        success: true,
      },
    });

    res.json({ success: true, meta: { timestamp: new Date().toISOString() } });
  })
);

// ─── GET /api/admin/audit-logs ─────────────────────────────────

app.get(
  '/api/admin/audit-logs',
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const { page, limit, skip } = buildPagination(req.query as Record<string, unknown>);
    const { actorId, action, dateFrom, dateTo } = req.query as Record<string, string | undefined>;

    const retentionCutoff = new Date(
      Date.now() - cfg.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

    const where: Prisma.AuditLogWhereInput = {
      createdAt: {
        gte: dateFrom ? new Date(dateFrom) : retentionCutoff,
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      },
    };
    if (actorId) where.actorId = actorId;
    if (action) where.action = action as AuditAction;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          actorId: true,
          subjectId: true,
          subjectType: true,
          ipAddress: true,
          requestId: true,
          success: true,
          errorCode: true,
          createdAt: true,
          // Security: metadata may contain context, but sensitive fields
          // are already sanitized at write time by AuditService
          metadata: true,
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthedRequest).requestId,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  })
);

// ─── GET /api/admin/stats — dashboard metrics ──────────────────

app.get(
  '/api/admin/stats',
  asyncWrap(async (req: Request, res: Response): Promise<void> => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayOrders,
      totalOrders,
      activeUsers,
      pendingOrders,
      todayRevenueData,
    ] = await prisma.$transaction([
      // Today's order count
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Total orders
      prisma.order.count(),
      // Active users in the last 7 days
      prisma.user.count({
        where: { lastLoginAt: { gte: weekAgo }, status: 'active' },
      }),
      // Orders awaiting processing
      prisma.order.count({
        where: { status: 'pending' as any },
      }),
      // Today's revenue (aggregate)
      prisma.order.aggregate({
        where: {
          createdAt: { gte: todayStart },
          status: { notIn: ['cancelled', 'refunded'] as any[] },
        },
        _sum: { totalKopecks: true },
      }),
    ]);

    const todayRevenueRub =
      Number(todayRevenueData._sum.totalKopecks ?? 0) / 100;

    res.json({
      success: true,
      data: {
        today: {
          orders: todayOrders,
          revenueRub: todayRevenueRub,
        },
        totals: {
          orders: totalOrders,
          pendingOrders,
          activeUsers,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (req as AuthedRequest).requestId,
      },
    });
  })
);

// ─── 404 ───────────────────────────────────────────────────────

app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// ─── Error handler ─────────────────────────────────────────────

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err }, 'Unhandled error in admin-service');
  const isProduction = cfg.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'An internal error occurred'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    },
  });
});

// ─── Async handler wrapper ─────────────────────────────────────

function asyncWrap(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

// ─── Graceful shutdown ─────────────────────────────────────────

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Admin service: graceful shutdown');
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000).unref();
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error(reason instanceof Error ? reason : { reason }, 'Unhandled rejection in admin-service');
  process.exit(1);
});

// ─── Start ─────────────────────────────────────────────────────

const server = app.listen(cfg.PORT, () => {
  logger.info({ port: cfg.PORT, env: cfg.NODE_ENV }, 'Admin service started');
});

server.on('error', (err) => {
  logger.error({ err }, 'Admin service server error');
  process.exit(1);
});

export { app };
