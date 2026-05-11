import { PrismaClient, OrderStatus, AuditAction, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error.middleware.js';
import { ProductService } from '../products/product.service.js';
import { AuditService } from '../../services/audit.service.js';

// =============================================================
// Order Service — secure order processing
//
// Security:
// - Server-side price calculation ONLY
// - Inventory locking (pessimistic locking via transactions)
// - Anti-fraud checks
// - Immutable order history
// - НИКОГДА не принимать цены из frontend
// =============================================================

export interface CreateOrderDto {
  userId: string;
  addressId?: string;
  items: Array<{ productId: string; quantity: number }>;
  deliveryMethod?: string;
  customerNote?: string;
  ipAddress: string;
  userAgent: string;
}

const ORDER_NUMBER_PREFIX = 'ORD';

export class OrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly productService: ProductService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Создаёт заказ с серверной валидацией цен и блокировкой стока
   *
   * Security flow:
   * 1. Validate all prices server-side
   * 2. Check inventory availability
   * 3. Anti-fraud scoring
   * 4. Lock inventory in transaction (pessimistic locking)
   * 5. Create order with snapshotted prices
   * 6. Audit log
   */
  async createOrder(dto: CreateOrderDto): Promise<{ orderId: string; orderNumber: string }> {
    // ─── 1. Server-side price validation ──────────────
    const priceValidation = await this.productService.validatePrices(dto.items);

    if (!priceValidation.valid) {
      throw new AppError(
        400,
        'INVALID_ITEMS',
        'Some items are unavailable or quantities are invalid'
      );
    }

    // ─── 2. Anti-fraud check ───────────────────────────
    const fraudScore = await this.calculateFraudScore(dto);
    if (fraudScore >= 80) {
      logger.error(
        { userId: dto.userId, fraudScore, ip: dto.ipAddress },
        'High fraud score — order blocked'
      );
      throw new AppError(403, 'ORDER_BLOCKED', 'Order blocked by security system');
    }

    // ─── 3. Calculate totals (server-side) ────────────
    const subtotalKopecks = priceValidation.items.reduce(
      (sum, item) => sum + item.totalKopecks,
      BigInt(0)
    );

    // TODO: apply discounts, calculate delivery
    const deliveryCostKopecks = BigInt(0);
    const totalKopecks = subtotalKopecks + deliveryCostKopecks;

    // ─── 4. Generate order number ─────────────────────
    const orderNumber = await this.generateOrderNumber();

    // ─── 5. Transaction: lock inventory + create order ─
    const order = await this.prisma.$transaction(async (tx) => {
      // Pessimistic lock: SELECT ... FOR UPDATE
      // Предотвращает race conditions при одновременных заказах
      for (const item of dto.items) {
        const product = await tx.$queryRaw<Array<{ stock_quantity: number; reserved_quantity: number }>>`
          SELECT stock_quantity, reserved_quantity
          FROM products
          WHERE id = ${item.productId}::uuid
          FOR UPDATE
        `;

        if (!product[0]) {
          throw new AppError(400, 'PRODUCT_NOT_FOUND', `Product ${item.productId} not found`);
        }

        const available = product[0].stock_quantity - product[0].reserved_quantity;
        if (available < item.quantity) {
          throw new AppError(
            409,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for product ${item.productId}`
          );
        }

        // Резервируем количество
        await tx.product.update({
          where: { id: item.productId },
          data: { reservedQuantity: { increment: item.quantity } },
        });
      }

      // Создаём заказ
      const newOrder = await tx.order.create({
        data: {
          number: orderNumber,
          userId: dto.userId,
          addressId: dto.addressId,
          status: OrderStatus.pending,
          subtotalKopecks,
          deliveryCostKopecks,
          totalKopecks,
          fraudScore,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent.slice(0, 500),
          customerNote: dto.customerNote?.slice(0, 1000),
          items: {
            create: priceValidation.items.map((item) => ({
              productId: item.productId,
              productName: item.name,
              productSku: item.sku,
              quantity: dto.items.find((i) => i.productId === item.productId)!.quantity,
              unitPriceKopecks: item.unitPriceKopecks,
              totalKopecks: item.totalKopecks,
            })),
          },
          statusHistory: {
            create: {
              toStatus: OrderStatus.pending,
              changedBy: dto.userId,
              comment: 'Order created',
            },
          },
        },
      });

      return newOrder;
    });

    await this.auditService.log(AuditAction.order_created, {
      actorId: dto.userId,
      subjectId: order.id,
      subjectType: 'order',
      ipAddress: dto.ipAddress,
      metadata: {
        orderNumber: order.number,
        totalRub: Number(totalKopecks) / 100,
        itemCount: dto.items.length,
        fraudScore,
      },
    });

    logger.info(
      { orderId: order.id, orderNumber, userId: dto.userId },
      'Order created'
    );

    return { orderId: order.id, orderNumber: order.number };
  }

  /**
   * Anti-fraud scoring
   * Возвращает score 0-100 (выше = подозрительнее)
   */
  private async calculateFraudScore(dto: CreateOrderDto): Promise<number> {
    let score = 0;

    // Много заказов за короткое время с одного IP
    const recentOrdersByIp = await this.prisma.order.count({
      where: {
        ipAddress: dto.ipAddress,
        createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) }, // 1 час
      },
    });

    if (recentOrdersByIp > 10) score += 30;
    if (recentOrdersByIp > 5) score += 15;

    // Много заказов от одного пользователя
    const recentOrdersByUser = await this.prisma.order.count({
      where: {
        userId: dto.userId,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24 часа
      },
    });

    if (recentOrdersByUser > 20) score += 25;
    if (recentOrdersByUser > 10) score += 10;

    // Большое количество товаров в одном заказе
    const totalItems = dto.items.reduce((s, i) => s + i.quantity, 0);
    if (totalItems > 100) score += 20;

    return Math.min(100, score);
  }

  /**
   * Генерирует уникальный номер заказа
   */
  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });

    return `${ORDER_NUMBER_PREFIX}-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async getOrder(orderId: string, userId: string, isAdmin = false) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        // Security: customers видят только свои заказы
        ...(isAdmin ? {} : { userId }),
      },
      include: {
        items: true,
        payments: {
          select: {
            id: true,
            provider: true,
            status: true,
            amountKopecks: true,
            paidAt: true,
            createdAt: true,
            // Security: не отдаём raw webhook data клиентам
            ...(isAdmin && { webhookData: true }),
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    // Конвертируем BigInt в числа для JSON serialization
    return {
      ...order,
      subtotalRub: Number(order.subtotalKopecks) / 100,
      deliveryCostRub: Number(order.deliveryCostKopecks) / 100,
      totalRub: Number(order.totalKopecks) / 100,
      items: order.items.map((item) => ({
        ...item,
        unitPriceRub: Number(item.unitPriceKopecks) / 100,
        totalRub: Number(item.totalKopecks) / 100,
      })),
    };
  }

  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    comment?: string
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    // Валидация state machine переходов
    if (!this.isValidStatusTransition(order.status, newStatus)) {
      throw new AppError(
        400,
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${order.status} to ${newStatus}`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...(newStatus === OrderStatus.confirmed && { confirmedAt: new Date() }),
          ...(newStatus === OrderStatus.cancelled && { cancelledAt: new Date() }),
        },
      });

      // Immutable history record
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy,
          comment,
        },
      });

      // При отмене — возвращаем резервацию
      if (newStatus === OrderStatus.cancelled) {
        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
          select: { productId: true, quantity: true },
        });

        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: { reservedQuantity: { decrement: item.quantity } },
          });
        }
      }
    });

    logger.info({ orderId, from: order.status, to: newStatus, changedBy }, 'Order status updated');
  }

  private isValidStatusTransition(
    from: OrderStatus,
    to: OrderStatus
  ): boolean {
    const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.pending]: [OrderStatus.confirmed, OrderStatus.cancelled],
      [OrderStatus.confirmed]: [OrderStatus.processing, OrderStatus.cancelled],
      [OrderStatus.processing]: [OrderStatus.shipped, OrderStatus.cancelled],
      [OrderStatus.shipped]: [OrderStatus.delivered],
      [OrderStatus.delivered]: [OrderStatus.refunded],
    };

    return transitions[from]?.includes(to) ?? false;
  }
}
