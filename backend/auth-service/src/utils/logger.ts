import pino from 'pino';
import { config } from '../config/index.js';

// =============================================================
// Structured logger — НИКОГДА не логировать sensitive data
// =============================================================

const redactPaths = [
  // Auth
  'req.headers.authorization',
  'req.headers.cookie',
  'body.otp',
  'body.code',
  'body.token',
  'body.password',
  'body.phone',
  'body.email',
  // Response
  'res.headers["set-cookie"]',
  // Custom
  'otp',
  'code',
  'token',
  'accessToken',
  'refreshToken',
  'phone',
  'phoneNumber',
  'email',
  'password',
  'secret',
  'key',
];

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'auth-service',
    env: config.NODE_ENV,
    pid: process.pid,
  },
});

/**
 * Security-специфичный логгер — для security events всегда error level
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
) {
  logger.error(
    {
      security_event: event,
      ...details,
      // Явно исключаем sensitive fields
      phone: undefined,
      otp: undefined,
      token: undefined,
    },
    `SECURITY: ${event}`
  );
}
