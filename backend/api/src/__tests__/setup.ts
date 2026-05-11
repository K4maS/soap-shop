import { vi } from 'vitest'

// ─── Mock env vars before any config module loads ─────────────
process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test'
process.env['REDIS_HOST'] = 'localhost'
process.env['REDIS_PORT'] = '6379'
process.env['REDIS_PASSWORD'] = 'testpassword'
process.env['JWT_ACCESS_SECRET'] = 'test-secret-minimum-32-chars-long-enough'
process.env['ENCRYPTION_KEY'] = 'dGVzdC1lbmNyeXB0aW9uLWtleS0zMi1ieXRlcw=='
process.env['CORS_ORIGINS'] = 'http://localhost:5173'
process.env['LOG_LEVEL'] = 'silent'
process.env['UPLOAD_MAX_SIZE_MB'] = '2'
process.env['LOCAL_UPLOAD_PATH'] = '/tmp/test-uploads'
process.env['UPLOAD_PROVIDER'] = 'local'
process.env['UPLOAD_ALLOWED_TYPES'] = 'image/jpeg,image/png,image/webp'
process.env['RATE_LIMIT_WINDOW_MS'] = '900000'
process.env['RATE_LIMIT_MAX_REQUESTS'] = '100'
process.env['AUDIT_LOG_RETENTION_DAYS'] = '90'

// ─── Silence logger output in tests ───────────────────────────
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
  logSecurityEvent: vi.fn(),
}))
