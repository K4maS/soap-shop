import { Router, Request, Response } from 'express';
import { PrismaClient, OtpPurpose, AuditAction } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
} from '../validators/auth.validator.js';
import { OtpService } from '../services/otp.service.js';
import { TokenService } from '../services/token.service.js';
import { SmsService } from '../services/sms.service.js';
import { AuditService } from '../services/audit.service.js';
import {
  getRealIp,
  getDeviceFingerprint,
  getSecureCookieOptions,
} from '../middleware/security.middleware.js';
import { ApiResponse } from '../types/index.js';

// =============================================================
// Auth Routes — OTP + JWT flow
// =============================================================

export function createAuthRouter(prisma: PrismaClient): Router {
  const router = Router();
  const smsService = new SmsService();
  const otpService = new OtpService(prisma, smsService);
  const tokenService = new TokenService(prisma);
  const auditService = new AuditService(prisma);

  const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 дней в секундах

  /**
   * POST /api/v1/auth/phone/request
   * Запрашивает OTP на номер телефона
   */
  router.post(
    '/phone/request',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const dto = requestOtpSchema.parse(req.body);
      const ip = getRealIp(req);
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const requestId = (req as any).requestId as string;

      const result = await otpService.requestOtp(
        dto.phone,
        ip,
        userAgent,
        OtpPurpose.login
      );

      await auditService.log(AuditAction.auth_otp_requested, {
        ipAddress: ip,
        userAgent,
        requestId,
        success: result.success,
        metadata: { retryAfter: result.retryAfter },
      });

      if (!result.success) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please try again later.',
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res
          .status(429)
          .setHeader('Retry-After', String(result.retryAfter ?? 60))
          .json(response);
        return;
      }

      const response: ApiResponse<{ expiresIn: number }> = {
        success: true,
        data: { expiresIn: 300 }, // 5 minutes
        meta: { requestId, timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    })
  );

  /**
   * POST /api/v1/auth/phone/verify
   * Верифицирует OTP и выдаёт токены
   */
  router.post(
    '/phone/verify',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const dto = verifyOtpSchema.parse(req.body);
      const ip = getRealIp(req);
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const requestId = (req as any).requestId as string;

      const verifyResult = await otpService.verifyOtp(
        dto.phone,
        dto.otp,
        ip,
        userAgent
      );

      if (!verifyResult.success || !verifyResult.userId) {
        await auditService.log(AuditAction.auth_otp_failed, {
          ipAddress: ip,
          userAgent,
          requestId,
          success: false,
          errorCode: (verifyResult as any).error ?? 'INVALID_OTP',
        });

        const isBlocked = (verifyResult as any).error === 'ACCOUNT_BLOCKED'
          || (verifyResult as any).error === 'MAX_ATTEMPTS_EXCEEDED';

        const response: ApiResponse = {
          success: false,
          error: {
            code: isBlocked ? 'ACCOUNT_BLOCKED' : 'INVALID_OTP',
            message: isBlocked
              ? 'Too many failed attempts. Account temporarily blocked.'
              : 'Invalid or expired OTP.',
          },
          meta: { requestId, timestamp: new Date().toISOString() },
        };

        res.status(isBlocked ? 429 : 401).json(response);
        return;
      }

      // Получаем роль пользователя
      const user = await prisma.user.findUnique({
        where: { id: verifyResult.userId },
        select: { role: true },
      });

      const role = user?.role ?? 'customer';

      const tokens = await tokenService.createTokenPair(
        verifyResult.userId,
        role,
        {
          ip,
          userAgent,
          deviceId: dto.deviceId,
          deviceName: dto.deviceName,
        }
      );

      await auditService.log(AuditAction.auth_otp_verified, {
        actorId: verifyResult.userId,
        ipAddress: ip,
        userAgent,
        requestId,
        success: true,
      });

      await auditService.log(AuditAction.auth_login_success, {
        actorId: verifyResult.userId,
        ipAddress: ip,
        userAgent,
        requestId,
        success: true,
        metadata: { deviceId: dto.deviceId },
      });

      // Refresh token — httpOnly cookie
      res.cookie(
        'refreshToken',
        tokens.refreshToken,
        getSecureCookieOptions(REFRESH_TOKEN_TTL)
      );

      const response: ApiResponse<{
        accessToken: string;
        expiresIn: number;
        userId: string;
        role: string;
      }> = {
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: 15 * 60, // 15 minutes
          userId: verifyResult.userId,
          role,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    })
  );

  /**
   * POST /api/v1/auth/refresh
   * Ротация токенов
   */
  router.post(
    '/refresh',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const refreshToken = req.cookies?.['refreshToken'] as string | undefined;
      const ip = getRealIp(req);
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const requestId = (req as any).requestId as string;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token provided' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(401).json(response);
        return;
      }

      const tokens = await tokenService.rotateTokens(refreshToken, {
        ip,
        userAgent,
      });

      if (!tokens) {
        // Очищаем cookie при невалидном токене
        res.clearCookie('refreshToken', { path: '/' });

        const response: ApiResponse = {
          success: false,
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'Session expired' },
          meta: { requestId, timestamp: new Date().toISOString() },
        };
        res.status(401).json(response);
        return;
      }

      await auditService.log(AuditAction.auth_token_refreshed, {
        ipAddress: ip,
        userAgent,
        requestId,
        success: true,
      });

      // Обновляем refresh token cookie
      res.cookie(
        'refreshToken',
        tokens.refreshToken,
        getSecureCookieOptions(REFRESH_TOKEN_TTL)
      );

      const response: ApiResponse<{ accessToken: string; expiresIn: number }> = {
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: 15 * 60,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      };

      res.status(200).json(response);
    })
  );

  /**
   * POST /api/v1/auth/logout
   */
  router.post(
    '/logout',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
      const refreshToken = req.cookies?.['refreshToken'] as string | undefined;
      const ip = getRealIp(req);
      const userAgent = req.headers['user-agent'] ?? 'unknown';
      const requestId = (req as any).requestId as string;

      if (refreshToken) {
        try {
          const { verifyRefreshToken } = await import('../utils/jwt.js');
          const payload = verifyRefreshToken(refreshToken);
          await tokenService.revokeToken(refreshToken, payload.sub);

          await auditService.log(AuditAction.auth_logout, {
            actorId: payload.sub,
            ipAddress: ip,
            userAgent,
            requestId,
            success: true,
          });
        } catch {
          // Token invalid — просто очищаем cookie
        }
      }

      res.clearCookie('refreshToken', { path: '/' });

      const response: ApiResponse = {
        success: true,
        meta: { requestId, timestamp: new Date().toISOString() },
      };
      res.status(200).json(response);
    })
  );

  return router;
}
