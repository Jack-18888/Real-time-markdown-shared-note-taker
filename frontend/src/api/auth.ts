import client from './client';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/register', {
    email,
    password,
  });
  return data;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function refreshToken(
  token: string
): Promise<RefreshResponse> {
  const { data } = await client.post<RefreshResponse>('/auth/refresh', {
    refreshToken: token,
  });
  return data;
}

export async function logoutUser(token: string): Promise<void> {
  await client.post('/auth/logout', { refreshToken: token });
}
