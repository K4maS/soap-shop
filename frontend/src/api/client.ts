import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import { useAuthStore } from '@store/auth.store';

// =============================================================================
// Axios client — production-grade, CSP-safe, token-in-memory
// =============================================================================

/** Generate a simple request ID (UUID-like) without crypto overhead */
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Read CSRF token from the cookie set by the backend */
function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='));
  return match ? decodeURIComponent(match.split('=')[1] ?? '') : null;
}

// ---------------------------------------------------------------------------
// Create base Axios instance
// ---------------------------------------------------------------------------

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] ?? '/api';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,     // Send httpOnly refresh-token cookie automatically
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Attach in-memory access token (NEVER from localStorage)
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    // 2. CSRF token — sent on mutating requests
    const csrfToken = getCsrfToken();
    if (csrfToken && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }

    // 3. Correlation ID for distributed tracing
    config.headers['X-Request-Id'] = generateRequestId();

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Token refresh logic (singleton promise — prevents concurrent refresh loops)
// ---------------------------------------------------------------------------

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let refreshFailureCallbacks: Array<() => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string): void {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
  refreshFailureCallbacks = [];
}

function onRefreshFailed(): void {
  refreshFailureCallbacks.forEach((cb) => cb());
  refreshSubscribers = [];
  refreshFailureCallbacks = [];
}

async function doRefresh(): Promise<string> {
  // Uses httpOnly cookie — no token in body needed
  const response = await axios.post<{ accessToken: string }>(
    `${BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  return response.data.accessToken;
}

// ---------------------------------------------------------------------------
// Response interceptor — handles 401 and token refresh
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    const status = error.response?.status;

    // If not 401 or already retried, propagate
    if (status !== 401 || originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }

    // Skip refresh for the auth endpoints themselves
    if (
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout')
    ) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(normalizeError(error));
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      // Queue this request until refresh completes
      return new Promise<AxiosResponse>((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(apiClient(originalRequest));
        });
        refreshFailureCallbacks.push(() => reject(new Error('Session expired')));
      });
    }

    isRefreshing = true;

    try {
      const newAccessToken = await doRefresh();
      useAuthStore.getState().setAccessToken(newAccessToken);
      onTokenRefreshed(newAccessToken);
      isRefreshing = false;

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch {
      isRefreshing = false;
      onRefreshFailed();
      useAuthStore.getState().clearAuth();
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }
  },
);

// ---------------------------------------------------------------------------
// Error normalizer — consistent error shape for UI
// ---------------------------------------------------------------------------

export type ApiClientError = {
  message: string;
  code: string;
  status: number | null;
  details?: Record<string, string[]> | undefined;
};

function normalizeError(error: AxiosError): ApiClientError {
  if (error.response) {
    const data = error.response.data as {
      error?: { message?: string; code?: string; details?: Record<string, string[]> };
      message?: string;
    };
    return {
      message: data.error?.message ?? data.message ?? 'Произошла ошибка',
      code: data.error?.code ?? 'UNKNOWN_ERROR',
      status: error.response.status,
      details: data.error?.details,
    };
  }

  if (error.request) {
    return {
      message: 'Нет соединения с сервером. Проверьте интернет-подключение.',
      code: 'NETWORK_ERROR',
      status: null,
    };
  }

  return {
    message: error.message ?? 'Произошла неизвестная ошибка',
    code: 'CLIENT_ERROR',
    status: null,
  };
}

// ---------------------------------------------------------------------------
// Typed request helpers
// ---------------------------------------------------------------------------

export async function get<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.get<{ data: T }>(url, config);
  return res.data.data;
}

export async function post<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.post<{ data: T }>(url, data, config);
  return res.data.data;
}

export async function put<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.put<{ data: T }>(url, data, config);
  return res.data.data;
}

export async function patch<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.patch<{ data: T }>(url, data, config);
  return res.data.data;
}

export async function del<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await apiClient.delete<{ data: T }>(url, config);
  return res.data.data;
}
