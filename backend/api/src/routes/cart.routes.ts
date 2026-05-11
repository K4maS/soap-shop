import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/error.middleware.js';
import { authenticate } from '../middleware/rbac.middleware.js';
import { ApiResponse } from '../types/index.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

// =============================================================
// Cart router — per-user cart management
//
// Security:
// - All routes require authentication
// - Ownership enforced on every operation: userId from JWT, never from body
// - Cart items validated via Zod before touching the DB
// - IDOR prevention: item modifications check cart owner
// =============================================================

// ─── Validation schemas ─────────────────────────────────────

const addItemSchema = z
  .object({
    productId: z.string().uuid('productId must be a valid UUID'),
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(999, 'Quantity cannot exceed 999'),
  })
  .strict('Unknown fields are not allowed');

const updateItemSchema = z
  .object({
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(999, 'Quantity cannot exceed 999'),
  })
  .strict('Unknown fields are not allowed');

// ─── Router factory ─────────────────────────────────────────

export function createCartRouter(prisma: PrismaClient): Router {
  const router = Router();

  // All cart routes require authentication
  router.use(authenticate());

  // ─── GET / — get caller's cart ─────────────────────────

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthenticatedRequest).user!.id;

      // Find or return an empty cart — no implicit creation on GET
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sku: true,
                  priceKopecks: true,
                  stockQuantity: true,
                  isActive: true,
                  images: {
                    where: { isPrimary: true },
                    select: { url: true, altText: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      const items = cart?.items ?? [];
      const totalKopecks = items.reduce(
        (sum, item) =>
          sum + Number(item.product.priceKopecks) * item.quantity,
        0
      );

      const response: ApiResponse = {
        success: true,
        data: {
          items: items.map((item) => ({
            id: item.id,
            product: {
              ...item.product,
              priceRub: Number(item.product.priceKopecks) / 100,
            },
            quantity: item.quantity,
            subtotalRub: (Number(item.product.priceKopecks) * item.quantity) / 100,
            addedAt: item.createdAt,
          })),
          totalRub: totalKopecks / 100,
          itemCount: items.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── POST /items — add item to cart ───────────────────────

  router.post(
    '/items',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthenticatedRequest).user!.id;
      const dto = addItemSchema.parse(req.body);

      // Verify product exists and is in stock
      const product = await prisma.product.findFirst({
        where: { id: dto.productId, isActive: true, deletedAt: null },
        select: {
          id: true,
          priceKopecks: true,
          stockQuantity: true,
          reservedQuantity: true,
          minOrderQuantity: true,
          maxOrderQuantity: true,
        },
      });

      if (!product) {
        throw new AppError(404, 'NOT_FOUND', 'Product not found or unavailable');
      }

      const available = product.stockQuantity - product.reservedQuantity;
      if (available < dto.quantity) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          `Only ${available} unit(s) available`
        );
      }

      if (dto.quantity < product.minOrderQuantity) {
        throw new AppError(
          400,
          'BELOW_MIN_QUANTITY',
          `Minimum order quantity is ${product.minOrderQuantity}`
        );
      }

      if (product.maxOrderQuantity && dto.quantity > product.maxOrderQuantity) {
        throw new AppError(
          400,
          'EXCEEDS_MAX_QUANTITY',
          `Maximum order quantity is ${product.maxOrderQuantity}`
        );
      }

      // Upsert cart then upsert item (idempotent)
      const cart = await prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        select: { id: true },
      });

      const existingItem = await prisma.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
        select: { id: true, quantity: true },
      });

      let cartItem;
      if (existingItem) {
        const newQty = existingItem.quantity + dto.quantity;
        cartItem = await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQty },
          select: { id: true, quantity: true, productId: true },
        });
      } else {
        cartItem = await prisma.cartItem.create({
          data: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity, priceSnapshotKopecks: product.priceKopecks },
          select: { id: true, quantity: true, productId: true },
        });
      }

      logger.info({ userId, productId: dto.productId, quantity: dto.quantity }, 'Cart item added');

      const response: ApiResponse = {
        success: true,
        data: cartItem,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── PATCH /items/:itemId — update quantity ────────────────

  router.patch(
    '/items/:itemId',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthenticatedRequest).user!.id;
      const { itemId } = req.params as { itemId: string };
      const dto = updateItemSchema.parse(req.body);

      if (!isValidUuid(itemId)) {
        throw new AppError(404, 'NOT_FOUND', 'Cart item not found');
      }

      // Security: ownership check — verify the item belongs to this user's cart
      const item = await prisma.cartItem.findFirst({
        where: {
          id: itemId,
          cart: { userId }, // JOIN-based ownership check
        },
        select: {
          id: true,
          productId: true,
          product: { select: { stockQuantity: true, reservedQuantity: true } },
        },
      });

      if (!item) {
        // Return 404 to avoid leaking existence of other users' items (IDOR prevention)
        throw new AppError(404, 'NOT_FOUND', 'Cart item not found');
      }

      const available =
        item.product.stockQuantity - item.product.reservedQuantity;
      if (dto.quantity > available) {
        throw new AppError(
          409,
          'INSUFFICIENT_STOCK',
          `Only ${available} unit(s) available`
        );
      }

      const updated = await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
        select: { id: true, quantity: true, productId: true },
      });

      const response: ApiResponse = {
        success: true,
        data: updated,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── DELETE /items/:itemId — remove item from cart ────────

  router.delete(
    '/items/:itemId',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const userId = (req as AuthenticatedRequest).user!.id;
      const { itemId } = req.params as { itemId: string };

      if (!isValidUuid(itemId)) {
        throw new AppError(404, 'NOT_FOUND', 'Cart item not found');
      }

      // Security: ownership check
      const item = await prisma.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
        select: { id: true },
      });

      if (!item) {
        throw new AppError(404, 'NOT_FOUND', 'Cart item not found');
      }

      await prisma.cartItem.delete({ where: { id: itemId } });

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
