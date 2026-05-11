import { PrismaClient, AuditAction } from '@prisma/client';
import { logger } from '../utils/logger.js';

// =============================================================
// AuditService — immutable audit trail for all significant actions
//
// Security rules:
//   - Audit records are NEVER deleted or updated
//   - Sensitive data (passwords, tokens, OTP, raw phone) is NEVER stored
//   - All security events must be logged here
//   - This service NEVER throws — errors go to pino so audit failures
//     do not disrupt the main request flow
// =============================================================

export interface AuditContext {
  /** User who performed the action (undefined for anonymous) */
  actorId?: string;
  /** Resource that was affected */
  subjectId?: string;
  /** Type of affected resource, e.g. 'order', 'product', 'user' */
  subjectType?: string;
  /** Real client IP (from req.ip after trust-proxy) */
  ipAddress?: string;
  /** User-Agent string (truncated to 500 chars) */
  userAgent?: string;
  /** Correlation ID from X-Request-Id header */
  requestId?: string;
  /** Arbitrary context data — sanitized before storage */
  metadata?: Record<string, unknown>;
  /** Whether the action succeeded */
  success?: boolean;
  /** Application-level error code when success = false */
  errorCode?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'otp',
  'code',
  'token',
  'accesstoken',
  'refreshtoken',
  'phone',
  'phonenumber',
  'email',
  'secret',
  'key',
  'creditcard',
  'cardnumber',
  'cvv',
  'authorization',
  'cookie',
]);

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Writes an audit log entry.
   * This method NEVER throws — all errors are forwarded to pino.
   */
  async log(action: AuditAction, ctx: AuditContext, tx?: PrismaClient): Promise<void> {
    try {
      const sanitizedMetadata = ctx.metadata
        ? (this.sanitizeMetadata(ctx.metadata) as Record<string, any>)
        : undefined;

      const client = tx || this.prisma;
      await client.auditLog.create({
        data: {
          action,
          actorId: ctx.actorId ?? null,
          subjectId: ctx.subjectId ?? null,
          subjectType: ctx.subjectType ?? null,
          ipAddress: ctx.ipAddress ?? null,
          userAgent: ctx.userAgent ? ctx.userAgent.slice(0, 500) : null,
          requestId: ctx.requestId ?? null,
          metadata: sanitizedMetadata ?? undefined,
          success: ctx.success ?? true,
          errorCode: ctx.errorCode ?? null,
        },
      });
    } catch (err) {
      // Audit failure must not disrupt the main flow, but we still need
      // a record — pino will capture it for alerting.
      logger.error({ err, action, actorId: ctx.actorId }, 'Failed to write audit log');
    }
  }

  /**
   * Recursively removes sensitive fields from metadata objects.
   * Comparison is case-insensitive and uses substring matching so that
   * fields like "userPassword" or "accessToken" are also caught.
   */
  sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = [...SENSITIVE_KEYS].some((s) =>
        lowerKey.includes(s)
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        sanitized[key] = this.sanitizeMetadata(
          value as Record<string, unknown>
        );
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
