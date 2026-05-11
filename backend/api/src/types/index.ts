import { Request } from 'express';

// =============================================================
// Shared types for the API service
// =============================================================

export type UserRole = 'customer' | 'manager' | 'admin' | 'accountant';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    jti: string;
    fingerprint: string;
  };
  requestId?: string;
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
    requestId?: string;
    timestamp: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export function buildPagination(page: number, limit: number): PaginationParams {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}
