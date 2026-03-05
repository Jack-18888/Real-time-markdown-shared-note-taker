import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

export function requireFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === '') {
        throw new AppError(400, 'VALIDATION_ERROR', `Missing required field: ${field}`);
      }
    }
    next();
  };
}
