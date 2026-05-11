import { PrismaClient, AuditAction, Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';

// =============================================================
// Audit Service — immutable audit trail
//
// Security principles:
// - Audit logs NEVER deleted or updated
// - НИКОГДА не включать sensitive data (пароли, OTP, токены, полные номера)
// - Все security events должны быть залогированы
// =============================================================

interface AuditContext {
  actorId?: string;
  subjectId?: string;
  subjectType?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorCode?: string;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(action: AuditAction, ctx: AuditContext): Promise<void> {
    try {
      // Sanitize metadata — убираем все sensitive поля
      const sanitizedMetadata = ctx.metadata
        ? this.sanitizeMetadata(ctx.metadata)
        : undefined;

      const data: Prisma.AuditLogUncheckedCreateInput = {
        action,
        actorId:     ctx.actorId     ?? null,
        subjectId:   ctx.subjectId   ?? null,
        subjectType: ctx.subjectType ?? null,
        ipAddress:   ctx.ipAddress   ?? null,
        userAgent:   ctx.userAgent   ? ctx.userAgent.slice(0, 500) : null,
        requestId:   ctx.requestId   ?? null,
        success:     ctx.success     ?? true,
        errorCode:   ctx.errorCode   ?? null,
        metadata:    sanitizedMetadata as Prisma.InputJsonValue ?? Prisma.DbNull,
      };

      await this.prisma.auditLog.create({ data });
    } catch (err) {
      // Audit logging failure не должна ломать основной поток
      // Но логируем через pino чтобы не потерять событие
      logger.error({ err, action, ctx }, 'Failed to write audit log');
    }
  }

  private sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'otp',
      'code',
      'token',
      'accessToken',
      'refreshToken',
      'phone',
      'phoneNumber',
      'email',
      'secret',
      'key',
      'creditCard',
      'cvv',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
