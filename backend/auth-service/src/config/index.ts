import { z } from 'zod';

// =============================================================
// Config validation — приложение не запустится без валидных env
// Security: все секреты проверяются на минимальную длину
// =============================================================

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3002),

  DATABASE_URL: z.string().min(10),

  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().min(8),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().min(32),

  CSRF_SECRET: z.string().min(16),

  OTP_LIFETIME_SECONDS: z.coerce.number().int().min(60).max(600).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  OTP_BLOCK_DURATION_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  OTP_RATE_PER_NUMBER_SECONDS: z.coerce.number().int().min(30).max(300).default(60),
  OTP_RATE_PER_IP_HOUR: z.coerce.number().int().min(1).max(20).default(5),

  SMS_PROVIDER: z.enum(['mock', 'smsaero', 'smsc', 'twilio']).default('mock'),
  SMSAERO_EMAIL: z.string().optional(),
  SMSAERO_API_KEY: z.string().optional(),
  SMSC_LOGIN: z.string().optional(),
  SMSC_PASSWORD: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
