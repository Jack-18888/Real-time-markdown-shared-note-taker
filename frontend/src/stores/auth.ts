import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
  loginUser,
  registerUser,
  refreshToken as refreshTokenApi,
  logoutUser,
} from '@/api/auth';
import type { AuthUser } from '@/api/auth';
import { setupInterceptors } from '@/api/client';

const REFRESH_TOKEN_KEY = 'refreshToken';

function parseJwtPayload(token: string): { sub?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshTokenValue = ref<string | null>(null);
  const initializing = ref(false);
  const isInitialized = ref(false);
  let initPromise: Promise<void> | null = null;

  const isAuthenticated = computed(
    () => user.value !== null && accessToken.value !== null
  );

  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshTokenValue.value = refresh;
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }

  function clearState() {
    user.value = null;
    accessToken.value = null;
    refreshTokenValue.value = null;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async function login(email: string, password: string) {
    const data = await loginUser(email, password);
    user.value = data.user;
    setTokens(data.accessToken, data.refreshToken);
  }

  async function register(email: string, password: string) {
    const data = await registerUser(email, password);
    user.value = data.user;
    setTokens(data.accessToken, data.refreshToken);
  }

  async function logout() {
    try {
      if (refreshTokenValue.value) {
        await logoutUser(refreshTokenValue.value);
      }
    } catch {
      // Ignore logout API errors
    } finally {
      clearState();
    }
  }

  async function refresh(): Promise<boolean> {
    const token =
      refreshTokenValue.value ||
      localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token) return false;

    try {
      const data = await refreshTokenApi(token);
      setTokens(data.accessToken, data.refreshToken);
      const payload = parseJwtPayload(data.accessToken);
      if (payload?.sub && payload?.email) {
        user.value = { id: payload.sub, email: payload.email };
      }
      return true;
    } catch {
      clearState();
      return false;
    }
  }

  async function initialize(): Promise<void> {
    if (isInitialized.value) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const token = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!token) {
        isInitialized.value = true;
        return;
      }

      initializing.value = true;
      refreshTokenValue.value = token;

      try {
        const data = await refreshTokenApi(token);
        setTokens(data.accessToken, data.refreshToken);

        const payload = parseJwtPayload(data.accessToken);
        if (payload?.sub && payload?.email) {
          user.value = { id: payload.sub, email: payload.email };
        } else {
          clearState();
        }
      } catch {
        clearState();
      } finally {
        initializing.value = false;
        isInitialized.value = true;
      }
    })();

    return initPromise;
  }

  // Set up Axios interceptors
  setupInterceptors({
    getToken: () => accessToken.value,
    refreshToken: refresh,
    onLogout: () => {
      clearState();
    },
  });

  return {
    user,
    accessToken,
    refreshTokenValue,
    initializing,
    isInitialized,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
    initialize,
  };
});
