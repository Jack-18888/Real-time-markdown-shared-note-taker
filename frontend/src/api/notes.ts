import client from './client';

export interface NoteListItem {
  id: string;
  title: string;
  folderId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  permission: 'owner' | 'read' | 'write';
}

export interface Note extends NoteListItem {
  content: string;
}

export interface NoteShare {
  userId: string;
  email: string;
  permission: 'read' | 'write';
}

export async function fetchNotes(folderId?: string): Promise<NoteListItem[]> {
  const params = folderId ? { folderId } : {};
  const { data } = await client.get<NoteListItem[]>('/notes', { params });
  return data;
}

export async function createNote(
  title: string,
  content: string,
  folderId?: string | null
): Promise<Note> {
  const { data } = await client.post<Note>('/notes', {
    title,
    content,
    folderId: folderId ?? null,
  });
  return data;
}

export async function fetchNote(id: string): Promise<Note> {
  const { data } = await client.get<Note>(`/notes/${id}`);
  return data;
}

export async function updateNote(
  id: string,
  updates: { title?: string; content?: string; folderId?: string | null }
): Promise<Note> {
  const { data } = await client.patch<Note>(`/notes/${id}`, updates);
  return data;
}

export async function deleteNote(id: string): Promise<void> {
  await client.delete(`/notes/${id}`);
}

export async function fetchNoteShares(
  noteId: string
): Promise<NoteShare[]> {
  const { data } = await client.get<NoteShare[]>(`/notes/${noteId}/shares`);
  return data;
}

export async function createNoteShare(
  noteId: string,
  email: string,
  permission: 'read' | 'write'
): Promise<NoteShare> {
  const { data } = await client.post<NoteShare>(`/notes/${noteId}/shares`, {
    email,
    permission,
  });
  return data;
}

export async function updateNoteShare(
  noteId: string,
  userId: string,
  permission: 'read' | 'write'
): Promise<NoteShare> {
  const { data } = await client.patch<NoteShare>(
    `/notes/${noteId}/shares/${userId}`,
    { permission }
  );
  return data;
}

export async function deleteNoteShare(
  noteId: string,
  userId: string
): Promise<void> {
  await client.delete(`/notes/${noteId}/shares/${userId}`);
}
