import { z } from 'zod';

// =============================================================
// Product validators — Zod schemas with .strict() to reject
// unknown fields and prevent mass-assignment vulnerabilities
// =============================================================

// ─── Reusable field definitions ────────────────────────────

const nameField = z
  .string()
  .min(1, 'Name is required')
  .max(255, 'Name must be at most 255 characters')
  .trim();

const skuField = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be at most 50 characters')
  .regex(/^[A-Z0-9_-]+$/i, 'SKU may only contain letters, digits, hyphens and underscores')
  .trim()
  .toUpperCase();

const slugField = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase kebab-case')
  .trim();

const priceField = z
  .number()
  .int('Price must be an integer (kopecks)')
  .min(0, 'Price cannot be negative')
  .max(100_000_000, 'Price is too large (max 1 000 000 RUB)');

const stockQtyField = z
  .number()
  .int('Stock quantity must be an integer')
  .min(0, 'Stock quantity cannot be negative')
  .max(1_000_000, 'Stock quantity is too large');

// ─── CreateProductDto ────────────────────────────────────────

export const createProductSchema = z
  .object({
    name: nameField,
    sku: skuField,
    slug: slugField,
    categoryId: z.string().uuid('categoryId must be a valid UUID'),
    priceKopecks: priceField,
    stockQty: stockQtyField.optional().default(0),
    description: z
      .string()
      .max(10_000, 'Description must be at most 10 000 characters')
      .trim()
      .optional(),
    weight: z
      .number()
      .int('Weight must be an integer (grams)')
      .min(0)
      .max(100_000, 'Weight cannot exceed 100 kg')
      .optional(),
    isActive: z.boolean().optional().default(true),
    tags: z
      .array(z.string().max(50).trim())
      .max(20, 'At most 20 tags are allowed')
      .optional()
      .default([]),
    imageUrl: z.string().url('imageUrl must be a valid URL').optional(),
  })
  .strict('Unknown fields are not allowed');

export type CreateProductDto = z.infer<typeof createProductSchema>;

// ─── UpdateProductDto ────────────────────────────────────────

export const updateProductSchema = createProductSchema
  .partial()
  .strict('Unknown fields are not allowed');

export type UpdateProductDto = z.infer<typeof updateProductSchema>;

// ─── ProductFiltersDto ───────────────────────────────────────

const SORT_BY_VALUES = ['createdAt', 'price', 'name'] as const;

export const productFiltersSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    minPrice: z
      .preprocess(
        (v) => (v !== undefined ? Number(v) : undefined),
        z.number().int().min(0).optional()
      ),
    maxPrice: z
      .preprocess(
        (v) => (v !== undefined ? Number(v) : undefined),
        z.number().int().min(0).optional()
      ),
    search: z
      .string()
      .max(100, 'Search query must be at most 100 characters')
      .trim()
      .optional(),
    page: z
      .preprocess(
        (v) => (v !== undefined ? Number(v) : 1),
        z.number().int().min(1).max(10_000)
      )
      .optional()
      .default(1),
    limit: z
      .preprocess(
        (v) => (v !== undefined ? Number(v) : 20),
        z.number().int().min(1).max(100)
      )
      .optional()
      .default(20),
    sortBy: z.enum(SORT_BY_VALUES).optional().default('createdAt'),
  })
  .strict('Unknown query parameters are not allowed')
  .refine(
    (data) =>
      data.minPrice === undefined ||
      data.maxPrice === undefined ||
      data.minPrice <= data.maxPrice,
    { message: 'minPrice must be less than or equal to maxPrice', path: ['minPrice'] }
  );

export type ProductFiltersDto = z.infer<typeof productFiltersSchema>;
