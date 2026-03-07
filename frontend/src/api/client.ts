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

export default client;
