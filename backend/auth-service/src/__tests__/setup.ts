import { vi } from 'vitest'

// ─── Mock env vars before any config module loads ─────────────
process.env['NODE_ENV'] = 'test'
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test'
process.env['REDIS_HOST'] = 'localhost'
process.env['REDIS_PORT'] = '6379'
process.env['REDIS_PASSWORD'] = 'testpassword'
process.env['JWT_ACCESS_SECRET'] = 'test-access-secret-minimum-32-chars-long'
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-minimum-32-chars-ok'
process.env['JWT_ACCESS_EXPIRES'] = '15m'
process.env['JWT_REFRESH_EXPIRES'] = '7d'
process.env['ENCRYPTION_KEY'] = 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXRlc3Q='
process.env['CSRF_SECRET'] = 'test-csrf-secret-16chars'
process.env['CORS_ORIGINS'] = 'http://localhost:5173'
process.env['SMS_PROVIDER'] = 'mock'
process.env['LOG_LEVEL'] = 'silent'
process.env['OTP_LIFETIME_SECONDS'] = '300'
process.env['OTP_MAX_ATTEMPTS'] = '3'
process.env['OTP_BLOCK_DURATION_MINUTES'] = '15'
process.env['OTP_RATE_PER_NUMBER_SECONDS'] = '60'
process.env['OTP_RATE_PER_IP_HOUR'] = '5'
process.env['BCRYPT_ROUNDS'] = '10'

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
