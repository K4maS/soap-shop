import { PrismaClient, Prisma } from '@prisma/client';
import { redis } from '../../utils/redis.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error.middleware.js';

// =============================================================
// Product Service — catalog management
//
// Security:
// - Server-side price validation
// - Inventory control
// - Redis caching с cache invalidation
// - Параметризованные запросы через Prisma (защита от SQL injection)
// =============================================================

const CACHE_TTL = 300; // 5 минут
const CACHE_KEY_PRODUCT = (id: string) => `product:${id}`;
const CACHE_KEY_LIST = (params: string) => `products:list:${params}`;

export interface ProductFilters {
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'name' | 'created';
}

export interface ProductListResult {
  items: ProductPublicDto[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// DTO — публичное представление (без себестоимости)
export interface ProductPublicDto {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  priceRub: number;
  oldPriceRub: number | null;
  inStock: boolean;
  stockQuantity: number;
  minOrderQuantity: number;
  maxOrderQuantity: number | null;
  weightGrams: number | null;
  unit: string;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  images: {
    url: string;
    altText: string | null;
    isPrimary: boolean;
  }[];
  attributes: Prisma.JsonValue;
  isFeatured: boolean;
}

export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  async getProduct(id: string, isAdmin = false): Promise<ProductPublicDto> {
    // ─── Cache check ──────────────────────────────────
    const cacheKey = CACHE_KEY_PRODUCT(id);
    const cached = await redis.get(cacheKey);
    if (cached && !isAdmin) {
      return JSON.parse(cached) as ProductPublicDto;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(isAdmin ? {} : { isActive: true }),
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          select: { url: true, altText: true, isPrimary: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    const dto = this.toPublicDto(product, isAdmin);

    // Cache только публичные запросы
    if (!isAdmin) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(dto));
    }

    return dto;
  }

  async getProductBySlug(slug: string): Promise<ProductPublicDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: {
          select: { url: true, altText: true, isPrimary: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    }

    return this.toPublicDto(product, false);
  }

  async listProducts(filters: ProductFilters): Promise<ProductListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    // Cache key из параметров
    const cacheKey = CACHE_KEY_LIST(JSON.stringify({ ...filters, page, limit }));
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProductListResult;
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.inStock && {
        stockQuantity: { gt: 0 },
      }),
      ...(filters.search && {
        OR: [
          // Security: Prisma параметризует запросы — SQL injection невозможен
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      // Цена в копейках
      ...(filters.minPrice && {
        priceKopecks: { gte: BigInt(filters.minPrice * 100) },
      }),
      ...(filters.maxPrice && {
        priceKopecks: { lte: BigInt(filters.maxPrice * 100) },
      }),
    };

    const orderBy = this.getOrderBy(filters.sortBy);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            select: { url: true, altText: true, isPrimary: true },
            take: 1,
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const result: ProductListResult = {
      items: items.map((p) => this.toPublicDto(p, false)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };

    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Проверяет цену товара на сервере
   * Security: НИКОГДА не доверять ценам из frontend
   */
  async validatePrices(
    items: Array<{ productId: string; quantity: number }>
  ): Promise<{
    valid: boolean;
    items: Array<{
      productId: string;
      unitPriceKopecks: bigint;
      totalKopecks: bigint;
      name: string;
      sku: string;
      inStock: boolean;
      available: number;
    }>;
  }> {
    const productIds = items.map((i) => i.productId);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        priceKopecks: true,
        stockQuantity: true,
        reservedQuantity: true,
        minOrderQuantity: true,
        maxOrderQuantity: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    const validatedItems = [];
    let allValid = true;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        allValid = false;
        continue;
      }

      const available = product.stockQuantity - product.reservedQuantity;
      const inStock = available >= item.quantity;

      if (!inStock) allValid = false;
      if (item.quantity < product.minOrderQuantity) allValid = false;
      if (product.maxOrderQuantity && item.quantity > product.maxOrderQuantity) allValid = false;

      validatedItems.push({
        productId: item.productId,
        unitPriceKopecks: product.priceKopecks,
        totalKopecks: product.priceKopecks * BigInt(item.quantity),
        name: product.name,
        sku: product.sku,
        inStock,
        available,
      });
    }

    return { valid: allValid && validatedItems.length === items.length, items: validatedItems };
  }

  async invalidateProductCache(productId: string): Promise<void> {
    const keys = await redis.keys(`mylo:api:product:${productId}*`);
    const listKeys = await redis.keys('mylo:api:products:list:*');
    const allKeys = [...keys, ...listKeys];

    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
    logger.info({ productId }, 'Product cache invalidated');
  }

  private toPublicDto(
    product: any,
    isAdmin: boolean
  ): ProductPublicDto {
    return {
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      // Конвертируем копейки в рубли для API
      priceRub: Number(product.priceKopecks) / 100,
      oldPriceRub: product.oldPriceKopecks
        ? Number(product.oldPriceKopecks) / 100
        : null,
      // Security: себестоимость только для admin
      ...(isAdmin && {
        costPriceRub: product.costPriceKopecks
          ? Number(product.costPriceKopecks) / 100
          : null,
      }),
      inStock: product.stockQuantity - (product.reservedQuantity ?? 0) > 0,
      stockQuantity: isAdmin
        ? product.stockQuantity
        : Math.min(product.stockQuantity, 999), // Не раскрываем точный остаток
      minOrderQuantity: product.minOrderQuantity,
      maxOrderQuantity: product.maxOrderQuantity,
      weightGrams: product.weightGrams,
      unit: product.unit,
      category: product.category,
      images: product.images ?? [],
      attributes: product.attributes,
      isFeatured: product.isFeatured,
    };
  }

  private getOrderBy(
    sortBy?: string
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sortBy) {
      case 'price_asc':
        return { priceKopecks: 'asc' };
      case 'price_desc':
        return { priceKopecks: 'desc' };
      case 'name':
        return { name: 'asc' };
      default:
        return { createdAt: 'desc' };
    }
  }
}
