import { Request, Response, NextFunction } from 'express';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listFolderShares,
  shareFolderWithUser,
  updateFolderShare,
  removeFolderShare,
} from '../services/folders.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const folders = await listFolders(req.user!.id);
    res.status(200).json(folders);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, parentId } = req.body;
    const folder = await createFolder(req.user!.id, name, parentId);
    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, parentId } = req.body;
    const folder = await updateFolder(req.user!.id, req.params.id as string, { name, parentId });
    res.status(200).json(folder);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteFolder(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// --- Sharing ---

export async function listShares(req: Request, res: Response, next: NextFunction) {
  try {
    const shares = await listFolderShares(req.user!.id, req.params.id as string);
    res.status(200).json(shares);
  } catch (err) {
    next(err);
  }
}

export async function createShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, permission } = req.body;
    const share = await shareFolderWithUser(
      req.user!.id,
      req.params.id as string,
      email,
      permission
    );
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
}

export async function updateShare(req: Request, res: Response, next: NextFunction) {
  try {
    const { permission } = req.body;
    const share = await updateFolderShare(
      req.user!.id,
      req.params.id as string,
      req.params.userId as string,
      permission
    );
    res.status(200).json(share);
  } catch (err) {
    next(err);
  }
}

export async function removeShare(req: Request, res: Response, next: NextFunction) {
  try {
    await removeFolderShare(
      req.user!.id,
      req.params.id as string,
      req.params.userId as string
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
