import { prisma } from '../lib/prisma';
import { AppError } from '../types';
import { resolveNotePermission, resolveFolderPermission } from './permissions';

export async function listNotes(userId: string, folderId?: string) {
  // Get owned notes
  const ownedWhere: Record<string, unknown> = { ownerId: userId };
  if (folderId !== undefined) ownedWhere.folderId = folderId;

  const ownedNotes = await prisma.note.findMany({
    where: ownedWhere,
    select: {
      id: true,
      title: true,
      folderId: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get notes shared directly via NoteShare
  const directShareWhere: Record<string, unknown> = { userId };
  if (folderId !== undefined) {
    directShareWhere.note = { folderId };
  }

  const directShares = await prisma.noteShare.findMany({
    where: directShareWhere,
    select: {
      permission: true,
      note: {
        select: {
          id: true,
          title: true,
          folderId: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  // Get notes accessible via FolderShare (notes in shared folders)
  const folderShares = await prisma.folderShare.findMany({
    where: { userId },
    select: { folderId: true, permission: true },
  });

  const sharedFolderIds = folderShares.map((fs) => fs.folderId);
  const folderPermissionMap = new Map(
    folderShares.map((fs) => [fs.folderId, fs.permission])
  );

  let folderNoteWhere: Record<string, unknown> = {
    folderId: { in: sharedFolderIds },
    ownerId: { not: userId },
  };
  if (folderId !== undefined) {
    // Only include if the requested folder is in the shared folders
    if (!sharedFolderIds.includes(folderId)) {
      folderNoteWhere = { id: '__impossible__' }; // no results
    } else {
      folderNoteWhere = { folderId, ownerId: { not: userId } };
    }
  }

  const folderNotes = await prisma.note.findMany({
    where: folderNoteWhere,
    select: {
      id: true,
      title: true,
      folderId: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Build result - content is excluded from list
  const owned = ownedNotes.map((n) => ({ ...n, permission: 'owner' as const }));

  const directNoteIds = new Set(directShares.map((s) => s.note.id));
  const direct = directShares.map((s) => ({
    ...s.note,
    permission: s.permission as 'read' | 'write',
  }));

  // Folder-shared notes, excluding those that are already owned or directly shared
  const ownedIds = new Set(ownedNotes.map((n) => n.id));
  const folderBased = folderNotes
    .filter((n) => !ownedIds.has(n.id) && !directNoteIds.has(n.id))
    .map((n) => ({
      ...n,
      permission: (folderPermissionMap.get(n.folderId!) ?? 'read') as 'read' | 'write',
    }));

  return [...owned, ...direct, ...folderBased];
}

export async function createNote(
  userId: string,
  title: string,
  content: string,
  folderId?: string | null
) {
  if (folderId) {
    const folder = await prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) {
      throw new AppError(404, 'NOT_FOUND', 'Folder not found');
    }

    const permission = await resolveFolderPermission(folderId, userId);
    if (!permission || permission === 'read') {
      throw new AppError(403, 'FORBIDDEN', 'No write access to folder');
    }
  }

  const note = await prisma.note.create({
    data: {
      title,
      content: content || '',
      ownerId: userId,
      folderId: folderId || null,
    },
  });

  return note;
}

export async function getNote(userId: string, noteId: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  const permission = await resolveNotePermission(noteId, userId);
  if (!permission) {
    throw new AppError(403, 'FORBIDDEN', 'No access to this note');
  }

  return {
    id: note.id,
    title: note.title,
    content: note.content,
    folderId: note.folderId,
    ownerId: note.ownerId,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    permission,
  };
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: { title?: string; content?: string; folderId?: string | null }
) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  const permission = await resolveNotePermission(noteId, userId);
  if (!permission || permission === 'read') {
    throw new AppError(403, 'FORBIDDEN', 'No write access to this note');
  }

  const updated = await prisma.note.update({
    where: { id: noteId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.folderId !== undefined && { folderId: data.folderId }),
    },
  });

  return updated;
}

export async function deleteNote(userId: string, noteId: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  if (note.ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can delete a note');
  }

  await prisma.note.delete({ where: { id: noteId } });
}
