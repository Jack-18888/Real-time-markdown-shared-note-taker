import { Request, Response, NextFunction } from 'express';
import {
  listNotes,
  createNote,
  getNote,
  updateNote,
  deleteNote,
} from '../services/notes.service';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const folderId = req.query.folderId as string | undefined;
    const notes = await listNotes(req.user!.id, folderId);
    res.status(200).json(notes);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, content, folderId } = req.body;
    const note = await createNote(req.user!.id, title, content, folderId);
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    const note = await getNote(req.user!.id, req.params.id as string);
    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, content, folderId } = req.body;
    const note = await updateNote(req.user!.id, req.params.id as string, { title, content, folderId });
    res.status(200).json(note);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteNote(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
