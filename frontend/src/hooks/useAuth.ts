import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@store/auth.store';
import { requestOtp, verifyOtp, logout as logoutApi, getMe } from '@api/auth.api';
import { refreshAccessToken } from '@api/auth.api';

// =============================================================================
// useAuth — custom hook for all authentication operations
// =============================================================================

export function useAuth() {
  const navigate = useNavigate();

  const {
    userId,
    role,
    user,
    isAuthenticated,
    isLoading,
    setAuth,
    setUser,
    clearAuth,
    setLoading,
    accessToken,
  } = useAuthStore();

  // ---------------------------------------------------------------------------
  // Silent refresh on mount — restores session from httpOnly cookie
  // ---------------------------------------------------------------------------
  const hasAttemptedRefresh = useRef(false);

  useEffect(() => {
    // Only attempt once per mount, and only if not already authenticated
    if (hasAttemptedRefresh.current || isAuthenticated) return;
    hasAttemptedRefresh.current = true;

    const silentRefresh = async () => {
      setLoading(true);
      try {
        const { accessToken: newToken } = await refreshAccessToken();
        const currentUser = await getMe();
        setAuth({ user: currentUser, accessToken: newToken });
      } catch {
        // No valid refresh token — user is not logged in, that's OK
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    void silentRefresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Request OTP
  // ---------------------------------------------------------------------------

  const sendOtp = useCallback(
    async (phone: string): Promise<{ expiresIn: number }> => {
      const result = await requestOtp(phone);
      return { expiresIn: result.expiresIn };
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Verify OTP — completes login
  // ---------------------------------------------------------------------------

  const verifyCode = useCallback(
    async (phone: string, code: string): Promise<void> => {
      setLoading(true);
      try {
        const authResponse = await verifyOtp(phone, code);
        setAuth({ user: authResponse.user, accessToken: authResponse.accessToken });
        toast.success(`Добро пожаловать, ${authResponse.user.name ?? 'пользователь'}!`);
        navigate('/', { replace: true });
      } catch (err) {
        setLoading(false);
        throw err;
      }
    },
    [navigate, setAuth, setLoading],
  );

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutApi();
    } catch {
      // Even if server-side logout fails, clear local state
    } finally {
      clearAuth();
      toast.success('Вы вышли из системы');
      navigate('/login', { replace: true });
    }
  }, [clearAuth, navigate]);

  // ---------------------------------------------------------------------------
  // Refresh user profile
  // ---------------------------------------------------------------------------

  const refreshUser = useCallback(async (): Promise<void> => {
    if (!isAuthenticated) return;
    try {
      const freshUser = await getMe();
      setUser(freshUser);
    } catch {
      // silently fail
    }
  }, [isAuthenticated, setUser]);

  return {
    // State
    userId,
    role,
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    isAdmin: role === 'admin' || role === 'manager',

    // Actions
    sendOtp,
    verifyCode,
    logout,
    refreshUser,
  };
}
