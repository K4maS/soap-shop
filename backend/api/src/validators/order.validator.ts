import { z } from 'zod';

// =============================================================
// Order validators — server-side validation for order creation
// Security: quantities bounded to prevent abuse; all IDs are
// validated as UUIDs to prevent injection via malformed IDs
// =============================================================

// ─── Order item ──────────────────────────────────────────────

const orderItemSchema = z
  .object({
    productId: z.string().uuid('productId must be a valid UUID'),
    quantity: z
      .number()
      .int('Quantity must be an integer')
      .min(1, 'Quantity must be at least 1')
      .max(999, 'Quantity cannot exceed 999 per line item'),
  })
  .strict('Unknown fields are not allowed in order items');

// ─── Delivery methods ─────────────────────────────────────────

const DELIVERY_METHODS = [
  'pickup',
  'courier',
  'cdek',
  'russianpost',
] as const;

// ─── CreateOrderDto ───────────────────────────────────────────

export const createOrderSchema = z
  .object({
    items: z
      .array(orderItemSchema)
      .min(1, 'Order must contain at least one item')
      .max(50, 'Order cannot contain more than 50 distinct items')
      .refine(
        (items) => {
          const ids = items.map((i) => i.productId);
          return new Set(ids).size === ids.length;
        },
        { message: 'Duplicate productId entries are not allowed' }
      ),
    addressId: z.string().uuid('addressId must be a valid UUID').optional(),
    deliveryMethod: z.enum(DELIVERY_METHODS).optional(),
    customerNote: z
      .string()
      .max(1000, 'Note must be at most 1000 characters')
      .trim()
      .optional(),
  })
  .strict('Unknown fields are not allowed')
  .refine(
    (data) =>
      data.deliveryMethod !== 'pickup' || data.addressId === undefined,
    {
      message: 'addressId should not be provided for pickup delivery',
      path: ['addressId'],
    }
  );

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

// ─── OrderFiltersDto ──────────────────────────────────────────

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export const orderFiltersSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    dateFrom: z
      .string()
      .datetime({ message: 'dateFrom must be a valid ISO 8601 datetime' })
      .optional(),
    dateTo: z
      .string()
      .datetime({ message: 'dateTo must be a valid ISO 8601 datetime' })
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
  })
  .strict('Unknown query parameters are not allowed')
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return new Date(data.dateFrom) <= new Date(data.dateTo);
      }
      return true;
    },
    { message: 'dateFrom must be before or equal to dateTo', path: ['dateFrom'] }
  );

export type OrderFiltersDto = z.infer<typeof orderFiltersSchema>;

// ─── UpdateOrderStatusDto ─────────────────────────────────────

export const updateOrderStatusSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, {
      required_error: 'status is required',
      invalid_type_error: 'status must be a valid order status',
    }),
    comment: z
      .string()
      .max(500, 'Comment must be at most 500 characters')
      .trim()
      .optional(),
  })
  .strict('Unknown fields are not allowed');

export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;
