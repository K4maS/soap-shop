import { z } from 'zod';

// =============================================================================
// Zod validation schemas — matches backend validators
// =============================================================================

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Russian mobile phone — "+79991234567" */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+7\d{10}$/, 'Введите корректный номер телефона в формате +7XXXXXXXXXX');

/** 6-digit OTP code */
export const otpCodeSchema = z
  .string()
  .length(6, 'Код должен содержать 6 цифр')
  .regex(/^\d{6}$/, 'Код должен содержать только цифры');

/** Email — optional but validated if provided */
export const emailSchema = z
  .string()
  .email('Введите корректный email')
  .max(255, 'Email слишком длинный');

export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional();

/** Russian postal code — 6 digits */
export const postalCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'Почтовый индекс должен содержать 6 цифр');

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// ---------------------------------------------------------------------------
// Checkout / Order schemas
// ---------------------------------------------------------------------------

export const checkoutSchema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя слишком длинное'),

  contactPhone: phoneSchema,

  contactEmail: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      'Введите корректный email',
    ),

  deliveryMethod: z.enum(['courier', 'pickup', 'post'], {
    errorMap: () => ({ message: 'Выберите способ доставки' }),
  }),

  city: z
    .string()
    .trim()
    .min(2, 'Введите город')
    .max(100, 'Название города слишком длинное'),

  street: z
    .string()
    .trim()
    .min(2, 'Введите улицу')
    .max(200, 'Название улицы слишком длинное'),

  building: z
    .string()
    .trim()
    .min(1, 'Введите номер дома')
    .max(20, 'Слишком длинный номер дома'),

  apartment: z.string().trim().max(10, 'Слишком длинный номер квартиры').optional(),

  postalCode: postalCodeSchema,

  comment: z.string().trim().max(500, 'Комментарий слишком длинный').optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// Conditional — address fields not required for pickup
export const checkoutSchemaWithDelivery = checkoutSchema.superRefine((data, ctx) => {
  if (data.deliveryMethod !== 'pickup') {
    if (!data.city || data.city.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['city'], message: 'Введите город' });
    }
    if (!data.street || data.street.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['street'], message: 'Введите улицу' });
    }
    if (!data.building || data.building.length < 1) {
      ctx.addIssue({ code: 'custom', path: ['building'], message: 'Введите номер дома' });
    }
    if (!data.postalCode || !/^\d{6}$/.test(data.postalCode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['postalCode'],
        message: 'Введите корректный почтовый индекс',
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Product admin schemas
// ---------------------------------------------------------------------------

export const productAdminSchema = z.object({
  name: z.string().trim().min(2, 'Минимум 2 символа').max(200, 'Максимум 200 символов'),
  description: z.string().trim().min(10, 'Минимум 10 символов').max(5000, 'Максимум 5000 символов'),
  shortDescription: z.string().trim().max(300, 'Максимум 300 символов').optional(),
  categoryId: z.string().uuid('Выберите категорию'),
  tags: z.array(z.string().trim()).max(10, 'Максимум 10 тегов').optional(),
  isFeatured: z.boolean().optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  weight: z.number().int().positive().optional(),
  ingredients: z.string().trim().max(2000).optional(),
  howToUse: z.string().trim().max(1000).optional(),
});

export type ProductAdminInput = z.infer<typeof productAdminSchema>;

// ---------------------------------------------------------------------------
// Profile update schema
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя слишком длинное')
    .optional(),
  email: optionalEmailSchema,
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract first error message from Zod error by field path.
 */
export function getZodError(
  errors: z.ZodError | null | undefined,
  field: string,
): string | undefined {
  return errors?.issues.find((i) => i.path.join('.') === field)?.message;
}
