import { PrismaClient, PaymentStatus, PaymentProvider, AuditAction, OrderStatus } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error.middleware.js';
import { AuditService } from '../../services/audit.service.js';

// =============================================================
// Payment Service — YooKassa integration (Refined)
//
// Security & Reliability:
// - Idempotent webhook handling
// - Atomic transactions (Payment + Order + Audit)
// - Strict state machine transitions
// - Replay protection placeholder
// =============================================================

export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditService: AuditService
  ) {}

  /**
   * Инициирует оплату для заказа
   */
  async initiatePayment(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (!order) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found');
    }

    if (order.userId !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied');
    }

    if (order.paymentStatus === PaymentStatus.paid) {
      throw new AppError(400, 'ALREADY_PAID', 'Order is already paid');
    }

    // В продакшене: вызов API YooKassa
    const externalId = `yoo_${Math.random().toString(36).substring(7)}`;
    const confirmationUrl = `https://yoomoney.ru/checkout/payments/v2/contract?orderId=${order.number}`;

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.yookassa,
        status: PaymentStatus.pending,
        amountKopecks: order.totalKopecks,
        externalId,
      },
    });

    await this.auditService.log(AuditAction.payment_initiated, {
      actorId: userId,
      subjectId: order.id,
      subjectType: 'order',
      metadata: { paymentId: payment.id, externalId },
    });

    return {
      paymentId: payment.id,
      confirmationUrl,
    };
  }

  /**
   * Обрабатывает вебхук от платёжной системы (Idempotent & Atomic)
   */
  async handleWebhook(provider: PaymentProvider, payload: any) {
    // ─── 1. Signature Verification (Security Placeholder) ──────
    // In production, verify that the request came from YooKassa IPs
    // and that the HMAC signature (if used) matches.
    if (!this.verifyWebhookSignature(payload)) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Webhook signature verification failed');
    }

    const externalId = payload.object?.id;
    const event = payload.event;

    if (!externalId) {
      throw new AppError(400, 'INVALID_PAYLOAD', 'Missing external ID');
    }

    // ─── 2. Transaction for Atomicity ─────────────────────────
    await this.prisma.$transaction(async (tx) => {
      // Lock payment record for update (prevent race conditions)
      const payment = await tx.$queryRaw<any[]>`
        SELECT * FROM payments WHERE external_id = ${externalId} FOR UPDATE
      `;

      if (!payment[0]) {
        logger.warn({ externalId, provider }, 'Payment record not found for webhook');
        return;
      }

      const currentStatus = payment[0].status as PaymentStatus;
      const orderId = payment[0].order_id;

      // ─── 3. Idempotency Check ───────────────────────────────
      // If payment is already in a terminal state, skip processing
      if ([PaymentStatus.paid, PaymentStatus.failed, PaymentStatus.cancelled].includes(currentStatus)) {
        logger.info({ externalId, currentStatus }, 'Payment already in terminal state, skipping');
        return;
      }

      // ─── 4. State Machine Transitions ───────────────────────
      const nextStatus = this.mapEventToStatus(event);
      if (!this.isValidTransition(currentStatus, nextStatus)) {
        logger.warn({ from: currentStatus, to: nextStatus }, 'Invalid payment status transition');
        return;
      }

      // ─── 5. Atomic Update ───────────────────────────────────
      await tx.payment.update({
        where: { id: payment[0].id },
        data: {
          status: nextStatus,
          externalStatus: payload.object?.status,
          webhookData: payload,
          ...(nextStatus === PaymentStatus.paid && { paidAt: new Date() }),
        },
      });

      if (nextStatus === PaymentStatus.paid) {
        // ─── 5.1 Update Order ─────────────────────────────
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: PaymentStatus.paid,
            status: OrderStatus.confirmed // Auto-confirm on payment
          },
        });

        // ─── 5.2 Reduce Stock (from Reserved) ─────────────
        // Fetch order items to update inventory
        const orderItems = await tx.orderItem.findMany({
          where: { orderId },
          select: { productId: true, quantity: true },
        });

        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity },
              reservedQuantity: { decrement: item.quantity },
            },
          });
        }

        // ─── 5.3 Audit Log ───────────────────────────────
        await this.auditService.log(AuditAction.payment_confirmed, {
          subjectId: orderId,
          subjectType: 'order',
          metadata: { paymentId: payment[0].id, externalId },
        }, tx as any);
      } else if (nextStatus === PaymentStatus.failed || nextStatus === PaymentStatus.cancelled) {
        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: nextStatus },
        });

        await this.auditService.log(AuditAction.payment_failed, {
          subjectId: orderId,
          subjectType: 'order',
          metadata: { paymentId: payment[0].id, externalId, error: payload.object?.description },
        }, tx as any);
      }

      logger.info(
        { orderId, paymentId: payment[0].id, from: currentStatus, to: nextStatus },
        'Payment status updated via webhook (atomic)'
      );
    });
  }

  /**
   * Проверка подлинности вебхука (IP Whitelist)
   * YooKassa official IPs: https://yookassa.ru/developers/using-api/webhooks#whitelist
   */
  private verifyWebhookSignature(_payload: any, requestIp?: string): boolean {
    // В продакшене раскомментировать проверку IP
    /*
    const allowedIps = [
      '185.71.76.0/27', '185.71.77.0/27', '77.75.153.0/25',
      '77.75.156.11', '77.75.156.35', '77.75.154.128/25'
    ];
    if (!requestIp || !isIpInRanges(requestIp, allowedIps)) return false;
    */
    return true;
  }

  private mapEventToStatus(event: string): PaymentStatus {
    switch (event) {
      case 'payment.succeeded': return PaymentStatus.paid;
      case 'payment.waiting_for_capture': return PaymentStatus.processing;
      case 'payment.canceled': return PaymentStatus.cancelled;
      default: return PaymentStatus.pending;
    }
  }

  private isValidTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    const transitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.pending]: [PaymentStatus.processing, PaymentStatus.paid, PaymentStatus.failed, PaymentStatus.cancelled],
      [PaymentStatus.processing]: [PaymentStatus.paid, PaymentStatus.failed, PaymentStatus.cancelled],
      [PaymentStatus.paid]: [],
      [PaymentStatus.failed]: [],
      [PaymentStatus.cancelled]: [],
      [PaymentStatus.refunded]: [],
    };
    return transitions[from]?.includes(to) ?? false;
  }
}
