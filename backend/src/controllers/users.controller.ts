import { Request, Response, NextFunction } from 'express';
import { getMe, searchUserByEmail } from '../services/users.service';
import { AppError } from '../types';

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getMe(req.user!.id);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const email = req.query.email as string | undefined;
    if (!email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Missing required query parameter: email');
    }
    const user = await searchUserByEmail(email);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}
