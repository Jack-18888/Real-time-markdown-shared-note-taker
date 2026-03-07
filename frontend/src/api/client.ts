import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
});

let getAccessToken: (() => string | null) | null = null;
let onUnauthorized: (() => Promise<boolean>) | null = null;
let onRefreshFailed: (() => void) | null = null;

export function setupInterceptors(options: {
  getToken: () => string | null;
  refreshToken: () => Promise<boolean>;
  onLogout: () => void;
}) {
  getAccessToken = options.getToken;
  onUnauthorized = options.refreshToken;
  onRefreshFailed = options.onLogout;
}

client.interceptors.request.use((config) => {
  const token = getAccessToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      onUnauthorized
    ) {
      if (isRefreshing) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshed = await onUnauthorized();
        if (refreshed) {
          const token = getAccessToken?.();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return client.request(originalRequest);
        }
        onRefreshFailed?.();
      } catch {
        onRefreshFailed?.();
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Extract a user-friendly error message from an Axios error or generic Error.
 * Prefers the backend's standard `{ error: "..." }` response format.
 * Falls back to sensible defaults for network errors and unknown errors.
 */
export function extractErrorMessage(
  err: unknown,
  fallback = 'An unexpected error occurred'
): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { error?: string } };
      message?: string;
    };
    // API returned an error response with our standard format
    if (axiosErr.response?.data?.error) {
      return axiosErr.response.data.error;
    }
    // HTTP status but no standard body
    const status = axiosErr.response?.status;
    if (status === 403) return 'You do not have access to this resource';
    if (status === 404) return 'The requested resource was not found';
    if (status === 409) return 'This resource already exists or conflicts with another';
    if (status && status >= 500) return 'Server error — please try again later';
    // Axios error without response (network error)
    if (!axiosErr.response && axiosErr.message) {
      return 'Unable to connect to the server. Please check your network connection.';
    }
  }
  if (err instanceof Error) {
    if (err.message === 'Network Error') {
      return 'Unable to connect to the server. Please check your network connection.';
    }
    return err.message;
  }
  return fallback;
}

/**
 * Extract the HTTP status code from an Axios error, or null if unavailable.
 */
export function extractErrorStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { status?: number } };
    return axiosErr.response?.status ?? null;
  }
  return null;
}

export default client;
