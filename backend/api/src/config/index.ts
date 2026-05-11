import { z } from 'zod';

// =============================================================
// Config — validated at startup; the app will not start without
// valid environment variables (fail-fast principle).
// Security: minimum-length checks prevent weak secrets.
// =============================================================

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().min(1024).max(65535).default(3001),

  DATABASE_URL: z.string().min(10),

  REDIS_HOST: z.string().min(1).default('redis'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().min(8),

  JWT_ACCESS_SECRET: z.string().min(32),

  ENCRYPTION_KEY: z.string().min(32),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  UPLOAD_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().min(1).max(20).default(2),
  UPLOAD_ALLOWED_TYPES: z
    .string()
    .default('image/jpeg,image/png,image/webp'),
  LOCAL_UPLOAD_PATH: z.string().default('/app/uploads'),

  // AWS S3 (optional — only required when UPLOAD_PROVIDER=s3)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_CLOUDFRONT_URL: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),

  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(30).default(90),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
