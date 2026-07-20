import { prisma } from '../lib/prisma';
import { AppError } from '../types';
import { resolveFolderPermission } from './permissions';
import { broadcastToUsers, getFolderAccessUserIds } from '../websocket/server';

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

  const userIds = await getFolderAccessUserIds(folder.id);
  broadcastToUsers(
    userIds,
    {
      event: 'folder:created',
      payload: { folder },
    },
    userId
  );

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

  const accessUserIdsBefore = await getFolderAccessUserIds(folderId);

  const updated = await prisma.folder.update({
    where: { id: folderId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
    },
  });

  const accessUserIdsAfter = await getFolderAccessUserIds(folderId);
  const userIds = Array.from(new Set([...accessUserIdsBefore, ...accessUserIdsAfter]));

  broadcastToUsers(
    userIds,
    {
      event: 'folder:updated',
      payload: { folder: updated },
    },
    userId
  );

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

  const userIds = await getFolderAccessUserIds(folderId);

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

  broadcastToUsers(
    userIds,
    {
      event: 'folder:deleted',
      payload: { folderId, deletedFolderIds: folderIdsToDelete },
    },
    userId
  );
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

// --- Folder Sharing ---

export async function listFolderShares(userId: string, folderId: string) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  if (folder.ownerId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can view shares');
  }

  const shares = await prisma.folderShare.findMany({
    where: { folderId },
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

export async function shareFolderWithUser(
  ownerId: string,
  folderId: string,
  targetEmail: string,
  permission: string
) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  if (folder.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can share this folder');
  }

  const targetUser = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!targetUser) {
    throw new AppError(404, 'NOT_FOUND', 'Target user not found');
  }

  if (targetUser.id === ownerId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Cannot share a folder with yourself');
  }

  const existing = await prisma.folderShare.findUnique({
    where: { folderId_userId: { folderId, userId: targetUser.id } },
  });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Folder is already shared with this user');
  }

  await prisma.folderShare.create({
    data: { folderId, userId: targetUser.id, permission },
  });

  broadcastToUsers([targetUser.id], {
    event: 'folder:shared',
    payload: {
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        ownerId: folder.ownerId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        permission,
      },
    },
  });

  return {
    userId: targetUser.id,
    email: targetUser.email,
    permission,
  };
}

export async function updateFolderShare(
  ownerId: string,
  folderId: string,
  targetUserId: string,
  permission: string
) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  if (folder.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can update shares');
  }

  const share = await prisma.folderShare.findUnique({
    where: { folderId_userId: { folderId, userId: targetUserId } },
  });
  if (!share) {
    throw new AppError(404, 'NOT_FOUND', 'Share not found');
  }

  const updated = await prisma.folderShare.update({
    where: { id: share.id },
    data: { permission },
    select: {
      userId: true,
      permission: true,
      user: { select: { email: true } },
    },
  });

  broadcastToUsers([updated.userId], {
    event: 'folder:updated',
    payload: {
      folder: {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        ownerId: folder.ownerId,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
        permission: updated.permission,
      },
    },
  });

  return {
    userId: updated.userId,
    email: updated.user.email,
    permission: updated.permission,
  };
}

export async function removeFolderShare(
  ownerId: string,
  folderId: string,
  targetUserId: string
) {
  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    throw new AppError(404, 'NOT_FOUND', 'Folder not found');
  }

  if (folder.ownerId !== ownerId) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner can remove shares');
  }

  const share = await prisma.folderShare.findUnique({
    where: { folderId_userId: { folderId, userId: targetUserId } },
  });
  if (!share) {
    throw new AppError(404, 'NOT_FOUND', 'Share not found');
  }

  await prisma.folderShare.delete({ where: { id: share.id } });

  broadcastToUsers([targetUserId], {
    event: 'folder:unshared',
    payload: { folderId },
  });
}
