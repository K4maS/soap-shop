import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// =============================================================
// Security middleware — defence in depth
// =============================================================

/**
 * Request ID middleware — уникальный ID для correlation logging
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId =
    (req.headers['x-request-id'] as string | undefined) || uuidv4();

  // Security: принимаем только безопасные символы в request ID
  const safeRequestId = /^[a-zA-Z0-9_-]{8,64}$/.test(requestId)
    ? requestId
    : uuidv4();

  (req as any).requestId = safeRequestId;
  res.setHeader('X-Request-Id', safeRequestId);
  next();
}

/**
 * Получает реальный IP с учётом proxy/nginx
 * Security: настроен trust proxy в Express для безопасной работы с forwarded headers
 */
export function getRealIp(req: Request): string {
  // Express с trust proxy устанавливает req.ip корректно
  return req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
}

/**
 * Fingerprint device — привязка токена к устройству
 * Security: не использовать для tracking, только для обнаружения кражи токена
 */
export function getDeviceFingerprint(req: Request): string {
  const ip = getRealIp(req);
  const ua = req.headers['user-agent'] ?? 'unknown';
  // Не используем IP в fingerprint напрямую чтобы не ломать мобильных пользователей
  return `${ua.slice(0, 100)}`;
}

/**
 * Security logging middleware
 */
export function securityLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const sensitiveRoutes = ['/auth/phone/request', '/auth/phone/verify', '/auth/refresh'];
  const path = req.path.toLowerCase();

  if (sensitiveRoutes.some((r) => path.includes(r))) {
    logger.info(
      {
        method: req.method,
        path: req.path,
        ip: getRealIp(req),
        requestId: (req as any).requestId,
        userAgent: req.headers['user-agent'],
        // Security: НЕ логируем body с OTP/phone
      },
      'Sensitive route accessed'
    );
  }

  next();
}

/**
 * CORS configuration — строгий whitelist
 */
export function getCorsOptions(allowedOrigins: string[]) {
  return {
    origin(
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) {
      // Разрешаем запросы без origin (server-to-server, curl)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, 'CORS blocked request');
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-Request-Id',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  };
}

/**
 * Cookie options — максимально безопасные настройки
 */
export function getSecureCookieOptions(maxAgeSeconds: number) {
  const isProduction = process.env['NODE_ENV'] === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict' as const,
    maxAge: maxAgeSeconds * 1000,
    path: '/',
    domain: isProduction ? process.env['COOKIE_DOMAIN'] : undefined,
  };
}
