import { prisma } from '../lib/prisma';
import { Permission } from '../types';

/**
 * Resolves a user's permission level on a folder.
 *
 * Resolution order:
 * 1. Owner — full access
 * 2. Direct FolderShare
 * 3. No access
 */
export async function resolveFolderPermission(
  folderId: string,
  userId: string
): Promise<Permission | null> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { ownerId: true },
  });

  if (!folder) return null;

  if (folder.ownerId === userId) return 'owner';

  const share = await prisma.folderShare.findUnique({
    where: { folderId_userId: { folderId, userId } },
    select: { permission: true },
  });

  if (share) return share.permission as Permission;

  return null;
}

/**
 * Resolves a user's permission level on a note.
 *
 * Resolution order:
 * 1. Owner — full access
 * 2. Direct NoteShare — takes precedence over folder share
 * 3. FolderShare on the note's folder (if note is in a folder)
 * 4. No access
 */
export async function resolveNotePermission(
  noteId: string,
  userId: string
): Promise<Permission | null> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { ownerId: true, folderId: true },
  });

  if (!note) return null;

  if (note.ownerId === userId) return 'owner';

  // Direct note share takes precedence
  const noteShare = await prisma.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId } },
    select: { permission: true },
  });

  if (noteShare) return noteShare.permission as Permission;

  // Fall back to folder share
  if (note.folderId) {
    const folderShare = await prisma.folderShare.findUnique({
      where: { folderId_userId: { folderId: note.folderId, userId } },
      select: { permission: true },
    });

    if (folderShare) return folderShare.permission as Permission;
  }

  return null;
}
