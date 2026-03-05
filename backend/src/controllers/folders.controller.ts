import { Request, Response, NextFunction } from 'express';
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
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
