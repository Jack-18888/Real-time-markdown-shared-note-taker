import { prisma } from '../lib/prisma';
import { AppError } from '../types';
import { resolveFolderPermission } from './permissions';

export async function listFolders(userId: string) {
  // Get owned folders
  const ownedFolders = await prisma.folder.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      parentId: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get shared folders
  const sharedFolderEntries = await prisma.folderShare.findMany({
    where: { userId },
    select: {
      permission: true,
      folder: {
        select: {
          id: true,
          name: true,
          parentId: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  const owned = ownedFolders.map((f) => ({ ...f, permission: 'owner' as const }));
  const shared = sharedFolderEntries.map((s) => ({
    ...s.folder,
    permission: s.permission as 'read' | 'write',
  }));

  return [...owned, ...shared];
}

export async function createFolder(userId: string, name: string, parentId?: string | null) {
  if (parentId) {
    const parent = await prisma.folder.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new AppError(404, 'NOT_FOUND', 'Parent folder not found');
    }

    const permission = await resolveFolderPermission(parentId, userId);
    if (!permission || permission === 'read') {
      throw new AppError(403, 'FORBIDDEN', 'No write access to parent folder');
    }
  }

  const folder = await prisma.folder.create({
    data: {
      name,
      ownerId: userId,
      parentId: parentId || null,
    },
  });

  return folder;
}

export async function updateFolder(
  userId: string,
  folderId: string,
  data: { name?: string; parentId?: string | null }
) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  const permission = await resolveFolderPermission(folderId, userId);
  if (!permission || permission === 'read') {
    throw new AppError(403, 'FORBIDDEN', 'No write access to this folder');
  }

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
    },
  });

  return updated;
}

export async function deleteFolder(userId: string, folderId: string) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  if (folder.ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can delete a folder');
  }

  // Recursively collect all descendant folder IDs
  const folderIdsToDelete = await collectDescendantFolderIds(folderId);
  folderIdsToDelete.push(folderId);

  // Delete everything in a transaction
  await prisma.$transaction([
    // Delete shares for all folders
    prisma.folderShare.deleteMany({
      where: { folderId: { in: folderIdsToDelete } },
    }),
    // Delete note shares for notes in these folders
    prisma.noteShare.deleteMany({
      where: { note: { folderId: { in: folderIdsToDelete } } },
    }),
    // Delete notes in these folders
    prisma.note.deleteMany({
      where: { folderId: { in: folderIdsToDelete } },
    }),
    // Delete child folders first (bottom-up order), then the target folder
    // We delete all at once since they're all collected
    prisma.folder.deleteMany({
      where: { id: { in: folderIdsToDelete } },
    }),
  ]);
}

async function collectDescendantFolderIds(parentId: string): Promise<string[]> {
  const children = await prisma.folder.findMany({
    where: { parentId },
    select: { id: true },
  });

  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    const descendants = await collectDescendantFolderIds(child.id);
    ids.push(...descendants);
  }

  return ids;
}
