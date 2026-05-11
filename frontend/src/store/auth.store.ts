import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UserRole, User } from '@/types';

// =============================================================================
// Auth Store — Zustand
// Access token is stored IN MEMORY ONLY — never persisted to localStorage
// or sessionStorage. The refresh token is an httpOnly cookie (backend concern).
// =============================================================================

type AuthStore = {
  // State
  userId: string | null;
  role: UserRole | null;
  accessToken: string | null;    // IN MEMORY — wiped on page reload (by design)
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setAuth: (params: { user: User; accessToken: string }) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
};

const initialState = {
  userId: null,
  role: null,
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
} satisfies Omit<AuthStore, 'setAuth' | 'setAccessToken' | 'setUser' | 'clearAuth' | 'setLoading'>;

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      ...initialState,

      /**
       * Called after successful OTP verification or token refresh.
       * Sets the access token IN MEMORY and records user metadata.
       */
      setAuth: ({ user, accessToken }) => {
        set(
          {
            userId: user.id,
            role: user.role,
            accessToken,      // IN MEMORY — never written to storage
            user,
            isAuthenticated: true,
            isLoading: false,
          },
          false,
          'setAuth',
        );
      },

      /**
       * Called by the token refresh interceptor to update the in-memory token.
       */
      setAccessToken: (token: string) => {
        set({ accessToken: token }, false, 'setAccessToken');
      },

      /**
       * Update user profile data without changing auth tokens.
       */
      setUser: (user: User) => {
        set({ user, userId: user.id, role: user.role }, false, 'setUser');
      },

      /**
       * Called on logout or when refresh token is expired.
       * Wipes all in-memory auth state.
       * NOTE: The backend must also clear the httpOnly cookie via Set-Cookie.
       */
      clearAuth: () => {
        set(initialState, false, 'clearAuth');
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading }, false, 'setLoading');
      },
    }),
    { name: 'AuthStore', enabled: import.meta.env.DEV },
  ),
);

// ---------------------------------------------------------------------------
// Selectors (stable references — avoids re-renders)
// ---------------------------------------------------------------------------

export const selectIsAuthenticated = (s: AuthStore) => s.isAuthenticated;
export const selectIsAdmin = (s: AuthStore) =>
  s.role === 'admin' || s.role === 'manager';
export const selectAccessToken = (s: AuthStore) => s.accessToken;
export const selectUser = (s: AuthStore) => s.user;
export const selectUserId = (s: AuthStore) => s.userId;
export const selectRole = (s: AuthStore) => s.role;
