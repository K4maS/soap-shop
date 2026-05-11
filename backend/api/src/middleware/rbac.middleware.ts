import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redis, tokenBlacklist } from '../utils/redis.js';
import { logger } from '../utils/logger.js';
import { AppError } from './error.middleware.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { hashToken } from '../utils/crypto.js';

// =============================================================
// RBAC Middleware — Role-Based Access Control
//
// Security:
// - JWT верифицируется на каждый запрос
// - Blacklist check в Redis (revoked tokens)
// - НИКОГДА не доверяем userId из body/params — только из токена
// - Ownership checks — пользователь видит только свои данные
// =============================================================

export type UserRole = 'customer' | 'manager' | 'admin' | 'accountant';

export interface AuthUser {
  id: string;
  role: UserRole;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

/**
 * Проверяет JWT из Authorization header
 * Security: Bearer token extraction с валидацией формата
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  // Базовая проверка формата JWT (три части, разделённых точкой)
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) {
    return null;
  }

  return token;
}

/**
 * Middleware: аутентификация через JWT
 * Устанавливает req.user при успешной верификации
 */
export function authenticate() {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    const token = extractBearerToken(req);

    if (!token) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    try {
      const payload = verifyAccessToken(token);

      // ─── Blacklist check ──────────────────────────
      const blacklisted = await redis.exists(tokenBlacklist(payload.jti));
      if (blacklisted) {
        logger.warn(
          { jti: payload.jti, ip: req.ip },
          'Revoked token used'
        );
        next(new AppError(401, 'TOKEN_REVOKED', 'Token has been revoked'));
        return;
      }

      req.user = {
        id: payload.sub,
        role: payload.role as UserRole,
        jti: payload.jti,
      };

      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        next(new AppError(401, 'TOKEN_EXPIRED', 'Token expired'));
      } else if (err instanceof jwt.JsonWebTokenError) {
        logger.warn({ err: err.message, ip: req.ip }, 'Invalid JWT');
        next(new AppError(401, 'INVALID_TOKEN', 'Invalid token'));
      } else {
        next(err);
      }
    }
  };
}

/**
 * Middleware: проверка роли
 * Security: роль берётся из верифицированного JWT, не из request
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles,
          path: req.path,
        },
        'Access denied: insufficient role'
      );
      next(new AppError(403, 'FORBIDDEN', 'Insufficient permissions'));
      return;
    }

    next();
  };
}

/**
 * Middleware: проверка ownership — пользователь может видеть только свои ресурсы
 * Security: предотвращает IDOR (Insecure Direct Object Reference)
 *
 * @param getResourceOwnerId функция, возвращающая владельца ресурса
 */
export function requireOwnership(
  getResourceOwnerId: (req: Request) => Promise<string | null>
) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }

    // Admins и managers видят всё
    if (['admin', 'manager'].includes(req.user.role)) {
      next();
      return;
    }

    try {
      const ownerId = await getResourceOwnerId(req);

      if (!ownerId) {
        next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
        return;
      }

      if (ownerId !== req.user.id) {
        logger.warn(
          {
            userId: req.user.id,
            ownerId,
            path: req.path,
            resourceId: req.params['id'],
          },
          'IDOR attempt blocked'
        );
        // Security: возвращаем 404 вместо 403 чтобы не раскрывать существование ресурса
        next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: только admin
 */
export const adminOnly = () => requireRole('admin');

/**
 * Middleware: admin или manager
 */
export const staffOnly = () => requireRole('admin', 'manager');

/**
 * Middleware: любой аутентифицированный пользователь
 */
export const authRequired = () => authenticate();
