import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { ApiResponse } from '../types/index.js';

// =============================================================
// Centralized error handler
// Security: НИКОГДА не отдавать stack traces в production
// =============================================================

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req as any).requestId as string | undefined;

  // ─── Zod validation errors ────────────────────────
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten().fieldErrors,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    };
    res.status(400).json(response);
    return;
  }

  // ─── Application errors ───────────────────────────
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, statusCode: err.statusCode, requestId },
      err.message
    );

    const response: ApiResponse = {
      success: false,
      error: { code: err.code, message: err.message },
      meta: { requestId, timestamp: new Date().toISOString() },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // ─── Unknown errors ───────────────────────────────
  logger.error({ err, requestId }, 'Unhandled error');

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      // Security: в production НЕ раскрываем детали
      message:
        process.env['NODE_ENV'] === 'production'
          ? 'An internal error occurred'
          : (err instanceof Error ? err.message : 'Unknown error'),
    },
    meta: { requestId, timestamp: new Date().toISOString() },
  };

  res.status(500).json(response);
}

/**
 * Async wrapper — оборачивает async route handler
 * Предотвращает unhandled promise rejections
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
