import pino from 'pino';
import { config } from '../config/index.js';

// =============================================================
// Structured logger — pino with sensitive data redaction
// NEVER log: passwords, tokens, OTPs, raw phone numbers, emails
// =============================================================

const redactPaths = [
  // HTTP headers
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',

  // Request body fields
  'body.otp',
  'body.code',
  'body.token',
  'body.password',
  'body.phone',
  'body.email',
  'body.creditCard',
  'body.cardNumber',
  'body.cvv',

  // Top-level log context fields
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
  'authorization',
  'cookie',
  'creditCard',
  'cardNumber',
  'cvv',
];

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'api',
    env: config.NODE_ENV,
    pid: process.pid,
  },
  // In production, emit pure JSON. In development, use pino-pretty if available.
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

/**
 * Logs a security-relevant event at error level so it is always captured
 * by alerting pipelines regardless of the configured log level.
 *
 * Security: explicit property deletions prevent any accidental leakage
 * of sensitive values that might exist in the caller's scope.
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
): void {
  logger.error(
    {
      security_event: event,
      ...details,
      // Explicitly clear sensitive fields even if caller passes them
      phone: undefined,
      otp: undefined,
      token: undefined,
      password: undefined,
      email: undefined,
    },
    `SECURITY: ${event}`
  );
}
