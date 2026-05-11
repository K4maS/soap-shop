import { PrismaClient, OtpPurpose } from '@prisma/client';
import { config } from '../config/index.js';
import {
  generateOtp,
  hashSecret,
  verifySecret,
  hashForSearch,
  encrypt,
} from '../utils/crypto.js';
import {
  redis,
  otpRateByPhone,
  otpRateByIp,
  otpBlock,
  checkRateLimit,
} from '../utils/redis.js';
import { logger, logSecurityEvent } from '../utils/logger.js';
import { SmsService } from './sms.service.js';

// =============================================================
// OTP Service — secure one-time password flow
//
// Security design:
// - OTP stored ONLY as argon2id hash
// - Rate limiting: 1 SMS/60s per number, 5 SMS/hour per IP
// - Max 3 attempts, 15 min block after exceeded
// - OTP single-use (marked used after verification)
// - 5 minute lifetime
// =============================================================

export class OtpService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly smsService: SmsService
  ) {}

  /**
   * Запрашивает OTP для номера телефона
   *
   * Security flow:
   * 1. Rate limit by IP (5/hour)
   * 2. Rate limit by phone (1/60s)
   * 3. Check if user is blocked
   * 4. Generate cryptographically secure OTP
   * 5. Hash with argon2id (НИКОГДА не хранить plaintext)
   * 6. Save to DB
   * 7. Send via SMS
   */
  async requestOtp(
    phone: string,
    ip: string,
    userAgent: string,
    purpose: OtpPurpose = OtpPurpose.login
  ): Promise<{ success: boolean; retryAfter?: number }> {
    const phoneHash = hashForSearch(phone);

    // ─── 1. Rate limit by IP ───────────────────────────
    const ipRateKey = otpRateByIp(ip);
    const ipRate = await checkRateLimit(ipRateKey, config.OTP_RATE_PER_IP_HOUR, 3600);

    if (!ipRate.allowed) {
      logSecurityEvent('otp_rate_limit_ip', { ip, retryAfter: ipRate.retryAfter });
      return { success: false, ...(ipRate.retryAfter !== undefined && { retryAfter: ipRate.retryAfter }) };
    }

    // ─── 2. Rate limit by phone ────────────────────────
    const phoneRateKey = otpRateByPhone(phoneHash);
    const phoneRate = await checkRateLimit(
      phoneRateKey,
      1,
      config.OTP_RATE_PER_NUMBER_SECONDS
    );

    if (!phoneRate.allowed) {
      logSecurityEvent('otp_rate_limit_phone', {
        phoneHash,
        retryAfter: phoneRate.retryAfter,
      });
      return { success: false, ...(phoneRate.retryAfter !== undefined && { retryAfter: phoneRate.retryAfter }) };
    }

    // ─── 3. Найти или создать пользователя ─────────────
    let user = await this.prisma.user.findFirst({
      where: {
        phoneHash,
        deletedAt: null,
      },
      select: { id: true, status: true, blockedUntil: true },
    });

    if (!user) {
      // Создаём нового пользователя при первом входе
      user = await this.prisma.user.create({
        data: {
          phoneEncrypted: encrypt(phone),
          phoneHash,
        },
        select: { id: true, status: true, blockedUntil: true },
      });
    }

    // ─── 4. Проверить блокировку пользователя ──────────
    if (user.blockedUntil && user.blockedUntil > new Date()) {
      const retryAfter = Math.ceil(
        (user.blockedUntil.getTime() - Date.now()) / 1000
      );
      logSecurityEvent('otp_user_blocked', { userId: user.id, retryAfter });
      return { success: false, retryAfter };
    }

    // ─── 5. Инвалидировать старые OTP ─────────────────
    await this.prisma.otpCode.updateMany({
      where: {
        userId: user.id,
        purpose,
        isUsed: false,
        isBlocked: false,
      },
      data: { isUsed: true },
    });

    // ─── 6. Генерировать и сохранить OTP ──────────────
    const otpCode = generateOtp();
    const codeHash = await hashSecret(otpCode);
    const expiresAt = new Date(
      Date.now() + config.OTP_LIFETIME_SECONDS * 1000
    );

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        purpose,
        codeHash,
        expiresAt,
        ipAddress: ip,
        userAgent: userAgent.slice(0, 500),
      },
    });

    // ─── 7. Отправить SMS ─────────────────────────────
    try {
      await this.smsService.sendOtp(phone, otpCode);
      logger.info({ userId: user.id, purpose }, 'OTP sent successfully');
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send OTP SMS');
      // В dev режиме не фейлим — выводим в лог
      if (config.NODE_ENV === 'production') {
        throw err;
      }
    }

    return { success: true };
  }

  /**
   * Верифицирует OTP
   *
   * Security flow:
   * 1. Find valid (non-expired, non-used) OTP
   * 2. Check attempts count (max 3)
   * 3. Verify argon2id hash (constant-time)
   * 4. Mark OTP as used (single-use)
   * 5. Return userId for token creation
   */
  async verifyOtp(
    phone: string,
    otp: string,
    ip: string,
    userAgent: string,
    purpose: OtpPurpose = OtpPurpose.login
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    const phoneHash = hashForSearch(phone);

    const user = await this.prisma.user.findFirst({
      where: { phoneHash, deletedAt: null },
      select: { id: true, status: true, blockedUntil: true },
    });

    if (!user) {
      // Security: не раскрываем что номер не существует
      // Искусственная задержка для предотвращения timing attack
      await hashSecret('dummy'); // simulate hash check
      logSecurityEvent('otp_unknown_phone', { ip });
      return { success: false, error: 'INVALID_OTP' };
    }

    // ─── Проверить блокировку ──────────────────────────
    const blockKey = otpBlock(user.id);
    const blocked = await redis.get(blockKey);
    if (blocked) {
      const ttl = await redis.ttl(blockKey);
      logSecurityEvent('otp_verify_blocked', { userId: user.id, ip });
      return { success: false, error: 'ACCOUNT_BLOCKED', retryAfter: ttl } as any;
    }

    // ─── Найти активный OTP ───────────────────────────
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        purpose,
        isUsed: false,
        isBlocked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      logSecurityEvent('otp_not_found', { userId: user.id, ip });
      return { success: false, error: 'OTP_NOT_FOUND' };
    }

    // ─── Проверить количество попыток ─────────────────
    if (otpRecord.attempts >= config.OTP_MAX_ATTEMPTS) {
      await this.blockOtp(otpRecord.id, user.id);
      logSecurityEvent('otp_max_attempts', { userId: user.id, ip });
      return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED' };
    }

    // ─── Инкрементировать attempts ────────────────────
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });

    // ─── Верифицировать OTP (constant-time) ───────────
    const isValid = await verifySecret(otpRecord.codeHash, otp);

    if (!isValid) {
      const newAttempts = otpRecord.attempts + 1;

      if (newAttempts >= config.OTP_MAX_ATTEMPTS) {
        await this.blockOtp(otpRecord.id, user.id);
        logSecurityEvent('otp_max_attempts', { userId: user.id, ip });
        return { success: false, error: 'MAX_ATTEMPTS_EXCEEDED' };
      }

      logSecurityEvent('otp_invalid', {
        userId: user.id,
        ip,
        attemptsLeft: config.OTP_MAX_ATTEMPTS - newAttempts,
      });
      return { success: false, error: 'INVALID_OTP' };
    }

    // ─── Успех: пометить OTP как использованный ───────
    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // ─── Обновить статус пользователя ─────────────────
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'active',
        failedLogins: 0,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        loginCount: { increment: 1 },
      },
    });

    logger.info({ userId: user.id, purpose }, 'OTP verified successfully');
    return { success: true, userId: user.id };
  }

  private async blockOtp(otpId: string, userId: string): Promise<void> {
    const blockDurationSeconds = config.OTP_BLOCK_DURATION_MINUTES * 60;

    await Promise.all([
      this.prisma.otpCode.update({
        where: { id: otpId },
        data: { isBlocked: true },
      }),
      redis.setex(
        otpBlock(userId),
        blockDurationSeconds,
        '1'
      ),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          blockedUntil: new Date(Date.now() + blockDurationSeconds * 1000),
          blockedReason: 'Too many failed OTP attempts',
          failedLogins: { increment: 1 },
        },
      }),
    ]);
  }
}
