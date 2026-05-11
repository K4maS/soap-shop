import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware.js';
import { authenticate, requireRole } from '../middleware/rbac.middleware.js';
import { ProductService } from '../modules/products/product.service.js';
import { UploadService } from '../modules/upload/upload.service.js';
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from '../validators/product.validator.js';
import { ApiResponse, PaginationMeta } from '../types/index.js';

// =============================================================
// Products router — public catalogue + admin CRUD
// =============================================================

export function createProductsRouter(prisma: PrismaClient): Router {
  const router = Router();
  const productService = new ProductService(prisma);
  const uploadService = new UploadService();

  // ─── GET / — list products (public, cached) ───────────────

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const filters = productFiltersSchema.parse(req.query);
      const result = await productService.listProducts(filters as any);

      const response: ApiResponse<typeof result.items> & { meta: { pagination: PaginationMeta } } = {
        success: true,
        data: result.items,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.pages,
          },
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── GET /categories — list all active categories (cached) ─

  router.get(
    '/categories',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const categories = await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, description: true },
        orderBy: { sortOrder: 'asc' },
      });

      const response: ApiResponse = {
        success: true,
        data: categories,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── GET /:slug — product by slug (public) ────────────────

  router.get(
    '/:slug',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { slug } = req.params;

      // Validate slug format to prevent injection attempts
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found' },
        });
        return;
      }

      const product = await productService.getProductBySlug(slug);

      const response: ApiResponse = {
        success: true,
        data: product,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(200).json(response);
    })
  );

  // ─── POST / — create product (admin only, with upload) ────

  router.post(
    '/',
    authenticate(),
    requireRole('admin', 'manager'),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const dto = createProductSchema.parse(req.body);
      const product = await productService.getProduct(
        (await createProduct(prisma, dto)).id
      );

      const response: ApiResponse = {
        success: true,
        data: product,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
        },
      };

      res.status(201).json(response);
    })
  );

  // ─── PUT /:id — update product (admin/manager) ────────────

  router.put(
    '/:id',
    authenticate(),
    requireRole('admin', 'manager'),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params as { id: string };

      if (!isValidUuid(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid product ID' },
        });
        return;
      }

      const dto = updateProductSchema.parse(req.body);

      // Build update data excluding undefined fields
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(dto)) {
        if (value !== undefined) updateData[key] = value;
      }

      const updated = await prisma.product.update({
        where: { id },
        data: updateData as any,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            select: { url: true, altText: true, isPrimary: true, sortOrder: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      await productService.invalidateProductCache(id);

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

  // ─── DELETE /:id — soft delete (admin only) ───────────────

  router.delete(
    '/:id',
    authenticate(),
    requireRole('admin'),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params as { id: string };

      if (!isValidUuid(id)) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid product ID' },
        });
        return;
      }

      const existing = await prisma.product.findFirst({
        where: { id, deletedAt: null },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Product not found' },
        });
        return;
      }

      await prisma.product.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await productService.invalidateProductCache(id);

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

// ─── Internal helpers ──────────────────────────────────────

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function createProduct(
  prisma: PrismaClient,
  dto: {
    name: string;
    sku: string;
    slug: string;
    categoryId: string;
    priceKopecks: number;
    stockQty?: number;
    description?: string;
    weight?: number;
    isActive?: boolean;
    tags?: string[];
    imageUrl?: string;
  }
) {
  return prisma.product.create({
    data: {
      name: dto.name,
      sku: dto.sku,
      slug: dto.slug,
      categoryId: dto.categoryId,
      priceKopecks: BigInt(dto.priceKopecks),
      stockQuantity: dto.stockQty ?? 0,
      description: dto.description ?? null,
      weightGrams: dto.weight ?? null,
      isActive: dto.isActive ?? true,
      attributes: dto.tags?.length ? { tags: dto.tags } : undefined,
    },
    select: { id: true },
  });
}
