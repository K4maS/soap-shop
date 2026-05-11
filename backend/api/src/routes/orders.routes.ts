import { Router, Request, Response } from 'express';
import { PrismaClient, OrderStatus, AuditAction } from '@prisma/client';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { authenticate, requireRole } from '../middleware/rbac.middleware.js';
import { OrderService } from '../modules/orders/order.service.js';
import { ProductService } from '../modules/products/product.service.js';
import { AuditService } from '../services/audit.service.js';
import {
  createOrderSchema,
  orderFiltersSchema,
  updateOrderStatusSchema,
} from '../validators/order.validator.js';
import { ApiResponse, PaginationMeta } from '../types/index.js';
import type { AuthenticatedRequest } from '../types/index.js';

// =============================================================
// Orders router
//
// Security:
// - Prices validated server-side in OrderService (never from client)
// - Ownership check: users see only their own orders
// - IDOR prevention: 404 instead of 403 for other users' orders
// - Status transitions validated by state machine
// =============================================================

export function createOrdersRouter(prisma: PrismaClient): Router {
  const router = Router();
  const productService = new ProductService(prisma);
  const auditService = new AuditService(prisma);
  const orderService = new OrderService(prisma, productService, auditService);

  // ─── POST / — create order (authenticated) ────────────────

  router.post(
    '/',
    authenticate(),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user!.id;
      const dto = createOrderSchema.parse(req.body);

      const result = await orderService.createOrder({
        userId,
        addressId: dto.addressId,
        items: dto.items,
        deliveryMethod: dto.deliveryMethod,
        customerNote: dto.customerNote,
        ipAddress: req.ip ?? '0.0.0.0',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(201).json(response);
    })
  );

  // ─── GET / — list caller's orders (authenticated) ─────────

  router.get(
    '/',
    authenticate(),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user!.id;
      const isStaff = ['admin', 'manager'].includes(authedReq.user!.role);

      const filters = orderFiltersSchema.parse(req.query);
      const safePage = Math.max(1, filters.page ?? 1);
      const safeLimit = Math.min(100, Math.max(1, filters.limit ?? 20));
      const skip = (safePage - 1) * safeLimit;

      const where = {
        // Security: non-staff users can only see their own orders
        ...(isStaff ? {} : { userId }),
        ...(filters.status ? { status: filters.status as OrderStatus } : {}),
        ...(filters.dateFrom ? { createdAt: { gte: new Date(filters.dateFrom) } } : {}),
        ...(filters.dateTo
          ? {
              createdAt: {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                lte: new Date(filters.dateTo),
              },
            }
          : {}),
        deletedAt: null as null,
      };

      const [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: safeLimit,
          select: {
            id: true,
            number: true,
            status: true,
            totalKopecks: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { items: true } },
          },
        }),
        prisma.order.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: orders.map((o) => ({
          ...o,
          totalRub: Number(o.totalKopecks) / 100,
        })),
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit),
          } satisfies PaginationMeta,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── GET /:id — get specific order (ownership check) ──────

  router.get(
    '/:id',
    authenticate(),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const authedReq = req as AuthenticatedRequest;
      const userId = authedReq.user!.id;
      const isAdmin = ['admin', 'manager'].includes(authedReq.user!.role);
      const { id } = req.params as { id: string };

      if (!isValidUuid(id)) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found');
      }

      // Security: getOrder enforces ownership; returns 404 for other users' orders
      const order = await orderService.getOrder(id, userId, isAdmin);

      const response: ApiResponse = {
        success: true,
        data: order,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── PATCH /:id/status — update order status (staff only) ─

  router.patch(
    '/:id/status',
    authenticate(),
    requireRole('admin', 'manager'),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const authedReq = req as AuthenticatedRequest;
      const staffId = authedReq.user!.id;
      const { id } = req.params as { id: string };

      if (!isValidUuid(id)) {
        throw new AppError(404, 'NOT_FOUND', 'Order not found');
      }

      const dto = updateOrderStatusSchema.parse(req.body);

      await orderService.updateOrderStatus(
        id,
        dto.status as OrderStatus,
        staffId,
        dto.comment
      );

      await auditService.log(AuditAction.order_status_changed, {
        actorId: staffId,
        subjectId: id,
        subjectType: 'order',
        ipAddress: req.ip,
        requestId: (req as any).requestId,
        metadata: { newStatus: dto.status, comment: dto.comment },
      });

      const response: ApiResponse = {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  return router;
}

// ─── Helpers ───────────────────────────────────────────────

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
