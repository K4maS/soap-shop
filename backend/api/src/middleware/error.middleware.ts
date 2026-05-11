import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { ApiResponse } from '../types/index.js';

// =============================================================
// Centralized error handling
// Security: NEVER expose stack traces or internal details in production
// =============================================================

/**
 * Operational application error.
 *
 * isOperational = true  — known, expected condition (400, 401, 403, 404, etc.)
 * isOperational = false — programming error or unexpected failure
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ─── Common error factories ────────────────────────────────

export const Errors = {
  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),

  unauthorized: (msg = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', msg),

  forbidden: (msg = 'Insufficient permissions') =>
    new AppError(403, 'FORBIDDEN', msg),

  badRequest: (msg: string, code = 'BAD_REQUEST') =>
    new AppError(400, code, msg),

  conflict: (msg: string) => new AppError(409, 'CONFLICT', msg),

  tooManyRequests: (retryAfter: number) =>
    new AppError(429, 'RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfter}s`),
} as const;

// ─── Centralized error handler ─────────────────────────────

/**
 * Express 4-argument error handler.
 * Must be registered AFTER all routes and other middleware.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId as string | undefined;
  const timestamp = new Date().toISOString();
  const isProduction = process.env['NODE_ENV'] === 'production';

  // ─── Zod validation errors ───────────────────────
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
      meta: { requestId, timestamp },
    };
    res.status(400).json(response);
    return;
  }

  // ─── Operational application errors ──────────────
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, code: err.code, requestId },
        err.message
      );
    } else {
      logger.warn(
        { code: err.code, statusCode: err.statusCode, requestId },
        err.message
      );
    }

    const response: ApiResponse = {
      success: false,
      error: { code: err.code, message: err.message },
      meta: { requestId, timestamp },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // ─── Unknown / programming errors ─────────────────
  logger.error({ err, requestId }, 'Unhandled error');

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      // Security: never expose internal details in production
      message: isProduction
        ? 'An internal server error occurred'
        : err instanceof Error
          ? err.message
          : 'Unknown error',
    },
    meta: { requestId, timestamp },
  };

  res.status(500).json(response);
}

/**
 * Wraps an async Express route handler and forwards any rejected promises
 * to next() so the centralized error handler can process them.
 *
 * Usage:
 *   router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
