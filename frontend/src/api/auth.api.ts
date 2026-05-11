import { post, del } from './client';
import type { AuthResponse, User } from '@/types';

// =============================================================================
// Auth API calls
// =============================================================================

/**
 * Step 1 — Request OTP: sends a 6-digit code to the phone via SMS.
 * Backend rate-limits: max 3 attempts per 10 minutes.
 */
export async function requestOtp(phone: string): Promise<{ message: string; expiresIn: number }> {
  return post<{ message: string; expiresIn: number }, { phone: string }>(
    '/auth/otp/request',
    { phone },
  );
}

/**
 * Step 2 — Verify OTP: validates the code and returns tokens.
 * - accessToken is returned in the response body (stored IN MEMORY)
 * - refreshToken is set as httpOnly cookie by the server
 */
export async function verifyOtp(phone: string, code: string): Promise<AuthResponse> {
  return post<AuthResponse, { phone: string; code: string }>(
    '/auth/otp/verify',
    { phone, code },
  );
}

/**
 * Refresh the access token using the httpOnly refresh-token cookie.
 * No payload needed — cookie is sent automatically.
 */
export async function refreshAccessToken(): Promise<{ accessToken: string }> {
  return post<{ accessToken: string }>('/auth/refresh');
}

/**
 * Logout — invalidates the refresh token on the server and clears the cookie.
 */
export async function logout(): Promise<void> {
  return del<void>('/auth/logout');
}

/**
 * Get the currently authenticated user's profile.
 */
export async function getMe(): Promise<User> {
  const { get } = await import('./client');
  return get<User>('/auth/me');
}
