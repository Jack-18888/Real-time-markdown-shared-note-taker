import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export function auth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or missing token');
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;
    req.user = {
      id: payload.sub as string,
      email: payload.email as string,
    };
    next();
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or missing token');
  }
}
