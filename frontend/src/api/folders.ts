import client from './client';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  permission: 'owner' | 'read' | 'write';
}

export interface FolderShare {
  userId: string;
  email: string;
  permission: 'read' | 'write';
}

export async function fetchFolders(): Promise<Folder[]> {
  const { data } = await client.get<Folder[]>('/folders');
  return data;
}

export async function createFolder(
  name: string,
  parentId?: string | null
): Promise<Folder> {
  const { data } = await client.post<Folder>('/folders', {
    name,
    parentId: parentId ?? null,
  });
  return data;
}

export async function updateFolder(
  id: string,
  updates: { name?: string; parentId?: string | null }
): Promise<Folder> {
  const { data } = await client.patch<Folder>(`/folders/${id}`, updates);
  return data;
}

export async function deleteFolder(id: string): Promise<void> {
  await client.delete(`/folders/${id}`);
}

export async function fetchFolderShares(
  folderId: string
): Promise<FolderShare[]> {
  const { data } = await client.get<FolderShare[]>(
    `/folders/${folderId}/shares`
  );
  return data;
}

export async function createFolderShare(
  folderId: string,
  email: string,
  permission: 'read' | 'write'
): Promise<FolderShare> {
  const { data } = await client.post<FolderShare>(
    `/folders/${folderId}/shares`,
    { email, permission }
  );
  return data;
}

export async function updateFolderShare(
  folderId: string,
  userId: string,
  permission: 'read' | 'write'
): Promise<FolderShare> {
  const { data } = await client.patch<FolderShare>(
    `/folders/${folderId}/shares/${userId}`,
    { permission }
  );
  return data;
}

export async function deleteFolderShare(
  folderId: string,
  userId: string
): Promise<void> {
  await client.delete(`/folders/${folderId}/shares/${userId}`);
}
