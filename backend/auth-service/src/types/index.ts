import { Request } from 'express';

// =============================================================
// Shared types for auth service
// =============================================================

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    jti: string;
  };
  requestId?: string;
  fingerprint?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string | undefined;
    timestamp: string;
  };
}

export type UserRole = 'customer' | 'manager' | 'admin' | 'accountant';

export interface DeviceInfo {
  ip: string;
  userAgent: string;
  deviceId?: string;
}
