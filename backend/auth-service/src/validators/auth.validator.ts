import { z } from 'zod';

// =============================================================
// Auth validators — строгая валидация всех входных данных
// Security: Zod отклоняет любые неожиданные поля (strict mode)
// =============================================================

/**
 * Российский номер телефона: +7XXXXXXXXXX
 * Нормализуем к +7 формату
 */
const russianPhone = z
  .string()
  .trim()
  .transform((val) => {
    // Убираем всё кроме цифр и +
    const digits = val.replace(/[^\d+]/g, '');
    // 8XXXXXXXXXX → +7XXXXXXXXXX
    if (digits.startsWith('8') && digits.length === 11) {
      return `+7${digits.slice(1)}`;
    }
    // 7XXXXXXXXXX → +7XXXXXXXXXX
    if (digits.startsWith('7') && digits.length === 11) {
      return `+${digits}`;
    }
    return digits;
  })
  .pipe(
    z
      .string()
      .regex(/^\+7\d{10}$/, 'Укажите корректный российский номер телефона')
  );

export const requestOtpSchema = z
  .object({
    phone: russianPhone,
    // Клиент может отправить device fingerprint для привязки сессии
    deviceId: z.string().max(64).optional(),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    phone: russianPhone,
    otp: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'OTP должен состоять из 6 цифр'),
    deviceId: z.string().max(64).optional(),
    deviceName: z.string().max(200).optional(),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    // refresh token приходит из httpOnly cookie, не из body
    // но deviceId можно передать для fingerprint check
    deviceId: z.string().max(64).optional(),
  })
  .strict();

export type RequestOtpDto = z.infer<typeof requestOtpSchema>;
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
