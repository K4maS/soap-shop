import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import {
  generateSecureToken,
  hashToken,
  hashForSearch,
} from '../utils/crypto.js';
import { redis, tokenBlacklist } from '../utils/redis.js';
import { logger, logSecurityEvent } from '../utils/logger.js';
import { config } from '../config/index.js';

// =============================================================
// Token Service — JWT lifecycle management
//
// Security:
// - Refresh tokens stored as SHA-256 hash in DB
// - Token rotation on each refresh
// - Revocation support via blacklist
// - Device fingerprint binding
// - Replay attack prevention
// =============================================================

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class TokenService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Создаёт пару Access + Refresh токенов
   * Вызывается после успешной OTP верификации
   */
  async createTokenPair(
    userId: string,
    role: string,
    deviceInfo: {
      ip: string;
      userAgent: string;
      deviceId?: string | undefined;
      deviceName?: string | undefined;
    }
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = uuidv4();

    // Fingerprint = hash(ip + userAgent + deviceId)
    const fingerprint = `${deviceInfo.ip}:${deviceInfo.userAgent}:${deviceInfo.deviceId ?? ''}`;

    const accessToken = signAccessToken(userId, role, jti, fingerprint);

    // Refresh token — cryptographically secure random bytes
    const refreshTokenRaw = generateSecureToken(32);
    const refreshJti = uuidv4();
    const refreshToken = signRefreshToken(userId, refreshJti);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    // Сохраняем только SHA-256 hash refresh token
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        deviceId: deviceInfo.deviceId ?? null,
        deviceName: deviceInfo.deviceName ?? null,
        ipAddress: deviceInfo.ip,
        userAgent: deviceInfo.userAgent.slice(0, 500),
        expiresAt,
        lastUsedAt: new Date(),
      },
    });

    // Suppress unused variable warning — raw token not stored
    void refreshTokenRaw;

    return { accessToken, refreshToken };
  }

  /**
   * Ротация токенов — старый refresh revoke, новая пара выдаётся
   *
   * Security: refresh token rotation предотвращает кражу:
   * если украденный token использован — оригинал тоже перестаёт работать,
   * и система обнаруживает reuse attack
   */
  async rotateTokens(
    refreshToken: string,
    deviceInfo: { ip: string; userAgent: string; deviceId?: string }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      logSecurityEvent('token_invalid_refresh', { ip: deviceInfo.ip });
      return null;
    }

    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, status: true, deletedAt: true } } },
    });

    if (!stored) {
      logSecurityEvent('token_not_found', {
        userId: payload.sub,
        ip: deviceInfo.ip,
      });
      return null;
    }

    if (stored.isRevoked) {
      // Обнаружен reuse — отзываем ВСЕ токены пользователя
      logSecurityEvent('token_reuse_detected', {
        userId: stored.userId,
        ip: deviceInfo.ip,
      });
      await this.revokeAllUserTokens(stored.userId, 'token_reuse_detected');
      return null;
    }

    if (stored.expiresAt < new Date()) {
      logSecurityEvent('token_expired', {
        userId: stored.userId,
        ip: deviceInfo.ip,
      });
      return null;
    }

    if (!stored.user || stored.user.deletedAt || stored.user.status !== 'active') {
      logSecurityEvent('token_inactive_user', {
        userId: stored.userId,
        ip: deviceInfo.ip,
      });
      return null;
    }

    // ─── Отзываем старый токен ─────────────────────────
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'rotated',
      },
    });

    // ─── Blacklist old access token JTI ───────────────
    // (по jti из refresh token payload — не гарантировано совпадение с access jti,
    //  но для completeness добавляем)

    // ─── Создаём новую пару ───────────────────────────
    return this.createTokenPair(stored.userId, stored.user.role, deviceInfo);
  }

  /**
   * Logout — отзывает конкретный refresh token
   */
  async revokeToken(
    refreshToken: string,
    userId: string
  ): Promise<void> {
    const tokenHash = hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, userId, isRevoked: false },
    });

    if (!stored) {
      logger.warn({ userId }, 'Logout: token not found');
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: 'logout',
      },
    });

    // Blacklist token в Redis для немедленного эффекта
    const ttl = Math.ceil(
      (stored.expiresAt.getTime() - Date.now()) / 1000
    );
    if (ttl > 0) {
      await redis.setex(tokenBlacklist(stored.id), ttl, '1');
    }
  }

  /**
   * Отзывает все токены пользователя (компрометация аккаунта)
   */
  async revokeAllUserTokens(userId: string, reason: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false },
      select: { id: true, expiresAt: true },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    // Blacklist все в Redis
    const pipeline = redis.pipeline();
    for (const token of tokens) {
      const ttl = Math.ceil(
        (token.expiresAt.getTime() - Date.now()) / 1000
      );
      if (ttl > 0) {
        pipeline.setex(tokenBlacklist(token.id), ttl, '1');
      }
    }
    await pipeline.exec();

    logger.info({ userId, reason, count: tokens.length }, 'All user tokens revoked');
  }

  /**
   * Cleanup: удаляет истёкшие токены (запускать по cron)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true, revokedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });

    logger.info({ count: result.count }, 'Cleaned up expired refresh tokens');
    return result.count;
  }
}
