import client from './client';

export interface UserProfile {
  id: string;
  email: string;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  email: string;
}

export async function fetchMe(): Promise<UserProfile> {
  const { data } = await client.get<UserProfile>('/users/me');
  return data;
}

export async function searchUser(email: string): Promise<UserSearchResult> {
  const { data } = await client.get<UserSearchResult>('/users/search', {
    params: { email },
  });
  return data;
}
