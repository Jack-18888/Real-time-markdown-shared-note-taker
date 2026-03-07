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

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshTokenValue = ref<string | null>(null);
  const initializing = ref(false);

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
      return true;
    } catch {
      clearState();
      return false;
    }
  }

  async function initialize(): Promise<void> {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token) return;

    initializing.value = true;
    refreshTokenValue.value = token;

    try {
      const data = await refreshTokenApi(token);
      user.value = { id: '', email: '' };
      setTokens(data.accessToken, data.refreshToken);

      // Decode the access token to extract user info
      const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
      user.value = { id: payload.sub, email: payload.email };
    } catch {
      clearState();
    } finally {
      initializing.value = false;
    }
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
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
    initialize,
  };
});
