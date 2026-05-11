import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrderStatus } from '@prisma/client'
import { OrderService } from '../modules/orders/order.service.js'
import { AppError } from '../middleware/error.middleware.js'

// ─── Mock helpers ─────────────────────────────────────────────
function buildMockPrisma() {
  const tx = {
    order: { update: vi.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    product: { update: vi.fn().mockResolvedValue({}) },
  }

  return {
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
    orderStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    product: { update: vi.fn().mockResolvedValue({}) },
    // Transaction runs the callback with a nested tx object
    $transaction: vi.fn(async (fn: (tx: typeof tx) => Promise<unknown>) => fn(tx)),
    _tx: tx,
  }
}

function makeDbOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-uuid-1',
    number: 'ORD-2026-000001',
    userId: 'user-uuid-1',
    status: OrderStatus.pending,
    subtotalKopecks: BigInt(100000),
    deliveryCostKopecks: BigInt(0),
    totalKopecks: BigInt(100000),
    items: [
      {
        id: 'item-1',
        productId: 'prod-1',
        productName: 'Soap',
        productSku: 'SOAP-001',
        quantity: 2,
        unitPriceKopecks: BigInt(50000),
        totalKopecks: BigInt(100000),
      },
    ],
    payments: [],
    statusHistory: [],
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────
// getOrder
// ─────────────────────────────────────────────────────────────
describe('OrderService.getOrder', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: OrderService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new OrderService(prisma as any, null as any, null as any)
    prisma.order.findFirst.mockResolvedValue(makeDbOrder())
  })

  it('returns order with BigInt amounts converted to RUB numbers', async () => {
    const order = await service.getOrder('order-uuid-1', 'user-uuid-1')
    expect(order.subtotalRub).toBe(1000)
    expect(order.deliveryCostRub).toBe(0)
    expect(order.totalRub).toBe(1000)
  })

  it('converts item prices to RUB in each order item', async () => {
    const order = await service.getOrder('order-uuid-1', 'user-uuid-1')
    expect(order.items[0]!.unitPriceRub).toBe(500)
    expect(order.items[0]!.totalRub).toBe(1000)
  })

  it('throws AppError 404 ORDER_NOT_FOUND when order does not exist', async () => {
    prisma.order.findFirst.mockResolvedValue(null)
    await expect(service.getOrder('nonexistent', 'user-uuid-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'ORDER_NOT_FOUND' })
  })

  it('scopes query to userId for non-admin requests', async () => {
    await service.getOrder('order-uuid-1', 'user-uuid-1', false)
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-uuid-1' }),
      })
    )
  })

  it('does not scope query to userId for admin requests', async () => {
    await service.getOrder('order-uuid-1', 'user-uuid-1', true)
    const call = prisma.order.findFirst.mock.calls[0][0] as any
    // isAdmin=true means no userId filter in where clause
    expect(call.where.userId).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// updateOrderStatus — state machine
// ─────────────────────────────────────────────────────────────
describe('OrderService.updateOrderStatus — state machine', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: OrderService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new OrderService(prisma as any, null as any, null as any)
  })

  it('throws AppError 404 when order not found', async () => {
    prisma.order.findUnique.mockResolvedValue(null)
    await expect(service.updateOrderStatus('bad-id', OrderStatus.confirmed, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'ORDER_NOT_FOUND' })
  })

  it('throws AppError 400 INVALID_STATUS_TRANSITION for disallowed transitions', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.delivered })
    // delivered → confirmed is not valid
    await expect(service.updateOrderStatus('order-1', OrderStatus.confirmed, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS_TRANSITION' })
  })

  it('throws for cancelled → any transition (terminal state)', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.cancelled })
    await expect(service.updateOrderStatus('order-1', OrderStatus.confirmed, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 400, code: 'INVALID_STATUS_TRANSITION' })
  })

  it('allows pending → confirmed', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.pending })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.confirmed, 'admin-1')
    ).resolves.toBeUndefined()
  })

  it('allows pending → cancelled', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.pending })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.cancelled, 'admin-1')
    ).resolves.toBeUndefined()
  })

  it('allows confirmed → processing', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.confirmed })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.processing, 'admin-1')
    ).resolves.toBeUndefined()
  })

  it('allows processing → shipped', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.processing })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.shipped, 'admin-1')
    ).resolves.toBeUndefined()
  })

  it('allows shipped → delivered', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.shipped })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.delivered, 'admin-1')
    ).resolves.toBeUndefined()
  })

  it('allows delivered → refunded', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.delivered })
    await expect(
      service.updateOrderStatus('order-1', OrderStatus.refunded, 'admin-1')
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────
// updateOrderStatus — cancellation releases stock
// ─────────────────────────────────────────────────────────────
describe('OrderService.updateOrderStatus — cancellation releases reserved stock', () => {
  let prisma: ReturnType<typeof buildMockPrisma>
  let service: OrderService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = buildMockPrisma()
    service = new OrderService(prisma as any, null as any, null as any)

    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.pending })
    prisma._tx.orderItem.findMany.mockResolvedValue([
      { productId: 'prod-1', quantity: 3 },
      { productId: 'prod-2', quantity: 2 },
    ])
  })

  it('decrements reservedQuantity for each order item on cancellation', async () => {
    await service.updateOrderStatus('order-1', OrderStatus.cancelled, 'admin-1')

    expect(prisma._tx.product.update).toHaveBeenCalledTimes(2)
    expect(prisma._tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: { reservedQuantity: { decrement: 3 } },
      })
    )
    expect(prisma._tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-2' },
        data: { reservedQuantity: { decrement: 2 } },
      })
    )
  })

  it('does NOT decrement reservedQuantity for non-cancellation transitions', async () => {
    prisma.order.findUnique.mockResolvedValue({ id: 'order-1', status: OrderStatus.pending })
    await service.updateOrderStatus('order-1', OrderStatus.confirmed, 'admin-1')
    expect(prisma._tx.product.update).not.toHaveBeenCalled()
  })

  it('creates an immutable status history record', async () => {
    await service.updateOrderStatus('order-1', OrderStatus.cancelled, 'admin-1', 'Customer request')

    expect(prisma._tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 'order-1',
          fromStatus: OrderStatus.pending,
          toStatus: OrderStatus.cancelled,
          changedBy: 'admin-1',
          comment: 'Customer request',
        }),
      })
    )
  })
})
