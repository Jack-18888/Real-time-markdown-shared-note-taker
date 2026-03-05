import { Request, Response, NextFunction } from 'express';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logoutUser,
} from '../services/auth.service';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await registerUser(email, password);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const result = await refreshTokens(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    await logoutUser(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
