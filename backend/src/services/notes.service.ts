import { prisma } from '../lib/prisma';
import { AppError } from '../types';
import { resolveNotePermission, resolveFolderPermission } from './permissions';
import { broadcastToUsers, getFolderAccessUserIds } from '../websocket/server';

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

  if (note.folderId) {
    const userIds = await getFolderAccessUserIds(note.folderId);
    broadcastToUsers(
      userIds,
      {
        event: 'note:created',
        payload: {
          note: {
            id: note.id,
            title: note.title,
            folderId: note.folderId,
            ownerId: note.ownerId,
            createdAt: note.createdAt,
            updatedAt: note.updatedAt,
          },
        },
      },
      userId
    );
  }

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

  const folderIds = Array.from(
    new Set([updated.folderId, note.folderId].filter(Boolean) as string[])
  );
  if (folderIds.length > 0) {
    const userIdsSet = new Set<string>();
    for (const fid of folderIds) {
      const uids = await getFolderAccessUserIds(fid);
      uids.forEach((u) => userIdsSet.add(u));
    }
    broadcastToUsers(
      Array.from(userIdsSet),
      {
        event: 'note:updated_meta',
        payload: {
          note: {
            id: updated.id,
            title: updated.title,
            folderId: updated.folderId,
            ownerId: updated.ownerId,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        },
      },
      userId
    );
  }

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

  const folderId = note.folderId;
  await prisma.note.delete({ where: { id: noteId } });

  if (folderId) {
    const userIds = await getFolderAccessUserIds(folderId);
    broadcastToUsers(
      userIds,
      {
        event: 'note:deleted',
        payload: { noteId, folderId },
      },
      userId
    );
  }
}

// --- Note Sharing ---

export async function listNoteShares(userId: string, noteId: string) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  if (note.ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can view shares');
  }

  const shares = await prisma.noteShare.findMany({
    where: { noteId },
    select: {
      userId: true,
      permission: true,
      user: { select: { email: true } },
    },
  });

  return shares.map((s) => ({
    userId: s.userId,
    email: s.user.email,
    permission: s.permission,
  }));
}

export async function shareNoteWithUser(
  ownerId: string,
  noteId: string,
  targetEmail: string,
  permission: string
) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  if (note.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can share this note');
  }

  const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'Target user not found');
  }

  if (targetUser.id === ownerId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cannot share a note with yourself');
  }

  const existing = await prisma.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId: targetUser.id } },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Note is already shared with this user');
  }

  await prisma.noteShare.create({
    data: { noteId, userId: targetUser.id, permission },
  });

  broadcastToUsers([targetUser.id], {
    event: 'note:shared',
    payload: { noteId, permission },
  });

  return {
    userId: targetUser.id,
    email: targetUser.email,
    permission,
  };
}

export async function updateNoteShare(
  ownerId: string,
  noteId: string,
  targetUserId: string,
  permission: string
) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  if (note.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can update shares');
  }

  const share = await prisma.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId: targetUserId } },
  });
  if (!share) {
    throw new AppError(404, 'NOT_FOUND', 'Share not found');
  }

  const updated = await prisma.noteShare.update({
    where: { id: share.id },
    data: { permission },
    select: {
      userId: true,
      permission: true,
      user: { select: { email: true } },
    },
  });

  broadcastToUsers([updated.userId], {
    event: 'note:shared',
    payload: { noteId, permission: updated.permission },
  });

  return {
    userId: updated.userId,
    email: updated.user.email,
    permission: updated.permission,
  };
}

export async function removeNoteShare(
  ownerId: string,
  noteId: string,
  targetUserId: string
) {
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) {
    throw new AppError(404, 'NOT_FOUND', 'Note not found');
  }

  if (note.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can remove shares');
  }

  const share = await prisma.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId: targetUserId } },
  });
  if (!share) {
    throw new AppError(404, 'NOT_FOUND', 'Share not found');
  }

  await prisma.noteShare.delete({ where: { id: share.id } });

  broadcastToUsers([targetUserId], {
    event: 'note:unshared',
    payload: { noteId },
  });
}
