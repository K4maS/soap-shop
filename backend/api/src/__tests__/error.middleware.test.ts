import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import { z } from 'zod'
import {
  AppError,
  Errors,
  errorHandler,
  asyncHandler,
} from '../middleware/error.middleware.js'

// ─── Minimal Express mock helpers ─────────────────────────────
function makeReq(overrides: Record<string, unknown> = {}) {
  return { requestId: 'req-test-123', ...overrides } as any
}

function makeRes() {
  const jsonFn = vi.fn()
  const statusFn = vi.fn().mockReturnValue({ json: jsonFn })
  return { res: { status: statusFn } as any, statusFn, jsonFn }
}

function makeNext() {
  return vi.fn()
}

// ─────────────────────────────────────────────────────────────
// AppError class
// ─────────────────────────────────────────────────────────────
describe('AppError', () => {
  it('stores statusCode, code, and message', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Thing not found')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toBe('Thing not found')
  })

  it('isOperational defaults to true', () => {
    expect(new AppError(400, 'BAD', 'bad').isOperational).toBe(true)
  })

  it('isOperational can be set to false', () => {
    expect(new AppError(500, 'CRASH', 'crash', false).isOperational).toBe(false)
  })

  it('is an instance of Error', () => {
    expect(new AppError(400, 'X', 'x')).toBeInstanceOf(Error)
  })

  it('name is "AppError"', () => {
    expect(new AppError(400, 'X', 'x').name).toBe('AppError')
  })
})

// ─────────────────────────────────────────────────────────────
// Errors factory helpers
// ─────────────────────────────────────────────────────────────
describe('Errors factories', () => {
  it('notFound returns 404 NOT_FOUND', () => {
    const e = Errors.notFound('Product')
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('NOT_FOUND')
    expect(e.message).toContain('Product')
  })

  it('notFound uses "Resource" as default label', () => {
    expect(Errors.notFound().message).toContain('Resource')
  })

  it('unauthorized returns 401', () => {
    const e = Errors.unauthorized()
    expect(e.statusCode).toBe(401)
    expect(e.code).toBe('UNAUTHORIZED')
  })

  it('forbidden returns 403', () => {
    const e = Errors.forbidden()
    expect(e.statusCode).toBe(403)
    expect(e.code).toBe('FORBIDDEN')
  })

  it('badRequest returns 400 with custom code', () => {
    const e = Errors.badRequest('Invalid email', 'INVALID_EMAIL')
    expect(e.statusCode).toBe(400)
    expect(e.code).toBe('INVALID_EMAIL')
    expect(e.message).toBe('Invalid email')
  })

  it('conflict returns 409', () => {
    const e = Errors.conflict('Already exists')
    expect(e.statusCode).toBe(409)
    expect(e.code).toBe('CONFLICT')
  })

  it('tooManyRequests returns 429 RATE_LIMITED', () => {
    const e = Errors.tooManyRequests(60)
    expect(e.statusCode).toBe(429)
    expect(e.code).toBe('RATE_LIMITED')
    expect(e.message).toContain('60')
  })
})

// ─────────────────────────────────────────────────────────────
// errorHandler
// ─────────────────────────────────────────────────────────────
describe('errorHandler', () => {
  it('handles ZodError with 400 VALIDATION_ERROR', () => {
    const schema = z.object({ name: z.string() })
    let zodErr: z.ZodError
    try {
      schema.parse({ name: 123 })
    } catch (e) {
      zodErr = e as z.ZodError
    }

    const { res, statusFn, jsonFn } = makeRes()
    errorHandler(zodErr!, makeReq(), res, makeNext())

    expect(statusFn).toHaveBeenCalledWith(400)
    const body = jsonFn.mock.calls[0][0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeDefined()
  })

  it('handles AppError with the correct status code', () => {
    const { res, statusFn, jsonFn } = makeRes()
    errorHandler(new AppError(403, 'FORBIDDEN', 'Nope'), makeReq(), res, makeNext())

    expect(statusFn).toHaveBeenCalledWith(403)
    const body = jsonFn.mock.calls[0][0]
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('FORBIDDEN')
    expect(body.error.message).toBe('Nope')
  })

  it('includes requestId and timestamp in meta', () => {
    const { res, jsonFn } = makeRes()
    errorHandler(new AppError(400, 'X', 'x'), makeReq({ requestId: 'abc-123' }), res, makeNext())

    const body = jsonFn.mock.calls[0][0]
    expect(body.meta.requestId).toBe('abc-123')
    expect(body.meta.timestamp).toBeDefined()
  })

  it('handles unknown errors with 500 INTERNAL_ERROR', () => {
    const { res, statusFn, jsonFn } = makeRes()
    errorHandler(new Error('boom'), makeReq(), res, makeNext())

    expect(statusFn).toHaveBeenCalledWith(500)
    const body = jsonFn.mock.calls[0][0]
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('exposes error message for unknown errors in non-production env', () => {
    // NODE_ENV=test (set in setup.ts), so message is NOT masked
    const { res, jsonFn } = makeRes()
    errorHandler(new Error('raw detail'), makeReq(), res, makeNext())

    const body = jsonFn.mock.calls[0][0]
    expect(body.error.message).toBe('raw detail')
  })

  it('handles non-Error unknowns with "Unknown error" message', () => {
    const { res, statusFn, jsonFn } = makeRes()
    errorHandler('a plain string error', makeReq(), res, makeNext())

    expect(statusFn).toHaveBeenCalledWith(500)
    const body = jsonFn.mock.calls[0][0]
    expect(body.error.message).toBe('Unknown error')
  })
})

// ─────────────────────────────────────────────────────────────
// asyncHandler
// ─────────────────────────────────────────────────────────────
describe('asyncHandler', () => {
  it('forwards a rejected promise to next()', async () => {
    const next = makeNext()
    const err = new Error('async fail')
    const handler = asyncHandler(async () => { throw err })

    handler(makeReq(), {} as any, next)
    // Let the microtask queue flush
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(next).toHaveBeenCalledWith(err)
  })

  it('does NOT call next() when the handler resolves normally', async () => {
    const next = makeNext()
    const handler = asyncHandler(async (_req, res: any) => {
      res.called = true
    })

    const fakeRes = { called: false } as any
    handler(makeReq(), fakeRes, next)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(next).not.toHaveBeenCalled()
    expect(fakeRes.called).toBe(true)
  })
})
