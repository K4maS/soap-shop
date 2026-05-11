import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────
vi.mock('../utils/redis.js', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
  },
}))

import { ProductService } from '../modules/products/product.service.js'
import { redis } from '../utils/redis.js'
import { AppError } from '../middleware/error.middleware.js'

const mockGet = redis.get as Mock
const mockSetex = redis.setex as Mock

// ─── Fixtures ─────────────────────────────────────────────────
function makeDbProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-uuid-1',
    sku: 'SOAP-001',
    slug: 'lavender-soap',
    name: 'Lavender Soap',
    description: 'Nice soap',
    shortDescription: 'Soap',
    priceKopecks: BigInt(50000),     // 500 RUB
    oldPriceKopecks: BigInt(60000),  // 600 RUB
    costPriceKopecks: BigInt(20000), // 200 RUB (admin only)
    stockQuantity: 100,
    reservedQuantity: 10,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
    weightGrams: 200,
    unit: 'pcs',
    isActive: true,
    isFeatured: false,
    attributes: null,
    category: { id: 'cat-1', name: 'Soaps', slug: 'soaps' },
    images: [{ url: '/img/soap.jpg', altText: 'Soap', isPrimary: true, sortOrder: 0 }],
    ...overrides,
  }
}

function buildMockPrisma() {
  return {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  }
}

// ─────────────────────────────────────────────────────────────
// getProduct
// ─────────────────────────────────────────────────────────────
describe('ProductService.getProduct', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: ProductService

  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue(null)
    mockSetex.mockResolvedValue('OK')
    prisma = buildMockPrisma()
    service = new ProductService(prisma as any)
    prisma.product.findFirst.mockResolvedValue(makeDbProduct())
  })

  it('returns a public DTO with price in rubles', async () => {
    const dto = await service.getProduct('prod-uuid-1')
    expect(dto.priceRub).toBe(500)
    expect(dto.oldPriceRub).toBe(600)
    expect(dto.id).toBe('prod-uuid-1')
  })

  it('returns inStock: true when stock > reserved', async () => {
    const dto = await service.getProduct('prod-uuid-1')
    expect(dto.inStock).toBe(true) // 100 - 10 = 90 > 0
  })

  it('returns inStock: false when all stock is reserved', async () => {
    prisma.product.findFirst.mockResolvedValue(makeDbProduct({ stockQuantity: 5, reservedQuantity: 5 }))
    const dto = await service.getProduct('prod-uuid-1')
    expect(dto.inStock).toBe(false)
  })

  it('does NOT expose costPriceRub to non-admin callers', async () => {
    const dto = await service.getProduct('prod-uuid-1', false)
    expect((dto as any).costPriceRub).toBeUndefined()
  })

  it('exposes costPriceRub when isAdmin=true', async () => {
    const dto = await service.getProduct('prod-uuid-1', true)
    expect((dto as any).costPriceRub).toBe(200)
  })

  it('caps stockQuantity at 999 for non-admin to not leak exact inventory', async () => {
    prisma.product.findFirst.mockResolvedValue(makeDbProduct({ stockQuantity: 5000, reservedQuantity: 0 }))
    const dto = await service.getProduct('prod-uuid-1', false)
    expect(dto.stockQuantity).toBe(999)
  })

  it('returns exact stockQuantity for admin', async () => {
    prisma.product.findFirst.mockResolvedValue(makeDbProduct({ stockQuantity: 5000, reservedQuantity: 0 }))
    const dto = await service.getProduct('prod-uuid-1', true)
    expect(dto.stockQuantity).toBe(5000)
  })

  it('returns cached DTO on cache hit (no DB call)', async () => {
    // Cache stores the serialized DTO (numbers, not BigInts)
    const cachedDto = { id: 'prod-uuid-1', slug: 'lavender-soap', priceRub: 500 }
    mockGet.mockResolvedValue(JSON.stringify(cachedDto))

    await service.getProduct('prod-uuid-1')
    expect(prisma.product.findFirst).not.toHaveBeenCalled()
  })

  it('writes result to cache on cache miss', async () => {
    await service.getProduct('prod-uuid-1')
    expect(mockSetex).toHaveBeenCalledOnce()
  })

  it('skips cache for admin requests', async () => {
    await service.getProduct('prod-uuid-1', true)
    expect(mockSetex).not.toHaveBeenCalled()
  })

  it('throws AppError 404 when product not found', async () => {
    prisma.product.findFirst.mockResolvedValue(null)
    await expect(service.getProduct('nonexistent')).rejects.toThrow(AppError)
    await expect(service.getProduct('nonexistent')).rejects.toMatchObject({ statusCode: 404, code: 'PRODUCT_NOT_FOUND' })
  })
})

// ─────────────────────────────────────────────────────────────
// getProductBySlug
// ─────────────────────────────────────────────────────────────
describe('ProductService.getProductBySlug', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: ProductService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new ProductService(prisma as any)
    prisma.product.findFirst.mockResolvedValue(makeDbProduct())
  })

  it('returns DTO for a found slug', async () => {
    const dto = await service.getProductBySlug('lavender-soap')
    expect(dto.slug).toBe('lavender-soap')
  })

  it('throws AppError 404 when slug not found', async () => {
    prisma.product.findFirst.mockResolvedValue(null)
    await expect(service.getProductBySlug('no-such-slug')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ─────────────────────────────────────────────────────────────
// listProducts
// ─────────────────────────────────────────────────────────────
describe('ProductService.listProducts', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: ProductService

  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue(null)
    prisma = buildMockPrisma()
    service = new ProductService(prisma as any)
    prisma.product.findMany.mockResolvedValue([makeDbProduct()])
    prisma.product.count.mockResolvedValue(1)
  })

  it('returns items, total, page, limit, and pages', async () => {
    const result = await service.listProducts({})
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.pages).toBe(1)
  })

  it('clamps page to minimum 1', async () => {
    const result = await service.listProducts({ page: -5 })
    expect(result.page).toBe(1)
  })

  it('clamps limit to maximum 100', async () => {
    prisma.product.count.mockResolvedValue(500)
    prisma.product.findMany.mockResolvedValue(Array(100).fill(makeDbProduct()))
    const result = await service.listProducts({ limit: 999 })
    expect(result.limit).toBe(100)
  })

  it('calculates total pages correctly', async () => {
    prisma.product.count.mockResolvedValue(25)
    prisma.product.findMany.mockResolvedValue(Array(10).fill(makeDbProduct()))
    const result = await service.listProducts({ limit: 10 })
    expect(result.pages).toBe(3) // ceil(25/10)
  })

  it('serves from cache on cache hit', async () => {
    const cached = JSON.stringify({ items: [], total: 0, page: 1, limit: 20, pages: 0 })
    mockGet.mockResolvedValue(cached)
    const result = await service.listProducts({})
    expect(prisma.product.findMany).not.toHaveBeenCalled()
    expect(result.total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
// validatePrices
// ─────────────────────────────────────────────────────────────
describe('ProductService.validatePrices', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: ProductService

  const productInStock = {
    id: 'prod-1',
    name: 'Soap',
    sku: 'SOAP-001',
    priceKopecks: BigInt(1000),
    stockQuantity: 100,
    reservedQuantity: 0,
    minOrderQuantity: 1,
    maxOrderQuantity: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new ProductService(prisma as any)
  })

  it('returns valid: true for a normal order', async () => {
    prisma.product.findMany.mockResolvedValue([productInStock])
    const result = await service.validatePrices([{ productId: 'prod-1', quantity: 5 }])
    expect(result.valid).toBe(true)
    expect(result.items[0]?.totalKopecks).toBe(BigInt(5000))
  })

  it('returns valid: false when product does not exist', async () => {
    prisma.product.findMany.mockResolvedValue([]) // product not found
    const result = await service.validatePrices([{ productId: 'nonexistent', quantity: 1 }])
    expect(result.valid).toBe(false)
  })

  it('returns valid: false when quantity exceeds available stock', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...productInStock, stockQuantity: 5, reservedQuantity: 3 }])
    const result = await service.validatePrices([{ productId: 'prod-1', quantity: 10 }])
    expect(result.valid).toBe(false)
    expect(result.items[0]?.inStock).toBe(false)
  })

  it('returns valid: false when quantity is below minOrderQuantity', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...productInStock, minOrderQuantity: 5 }])
    const result = await service.validatePrices([{ productId: 'prod-1', quantity: 2 }])
    expect(result.valid).toBe(false)
  })

  it('returns valid: false when quantity exceeds maxOrderQuantity', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...productInStock, maxOrderQuantity: 3 }])
    const result = await service.validatePrices([{ productId: 'prod-1', quantity: 10 }])
    expect(result.valid).toBe(false)
  })

  it('calculates totalKopecks as unitPrice × quantity', async () => {
    prisma.product.findMany.mockResolvedValue([{ ...productInStock, priceKopecks: BigInt(2000) }])
    const result = await service.validatePrices([{ productId: 'prod-1', quantity: 3 }])
    expect(result.items[0]?.unitPriceKopecks).toBe(BigInt(2000))
    expect(result.items[0]?.totalKopecks).toBe(BigInt(6000))
  })
})
