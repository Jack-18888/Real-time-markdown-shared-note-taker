import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { prisma } from '../lib/prisma';
import { AppError } from '../types';

const BCRYPT_COST = 12;

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN! as StringValue;
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN! as StringValue;

function parseExpiry(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiresIn}`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: throw new Error(`Unknown time unit: ${unit}`);
  }
}

function signAccessToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email, jti: crypto.randomUUID() }, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, jti: crypto.randomUUID() }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN,
  });
}

async function storeRefreshToken(token: string, userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + parseExpiry(REFRESH_EXPIRES_IN));
  await prisma.refreshToken.create({
    data: { token, userId, expiresAt },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerUser(email: string, password: string) {
  if (!isValidEmail(email)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid email format');
  }

  if (!password || password.length < 8) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'Email already in use');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(refreshToken, user.id);

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid credentials');
  }

  const accessToken = signAccessToken(user.id, user.email);
  const refreshToken = signRefreshToken(user.id);
  await storeRefreshToken(refreshToken, user.id);

  return {
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken: string) {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
  });

  if (!stored) {
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token not found');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new AppError(401, 'UNAUTHORIZED', 'Refresh token expired');
  }

  // Rotate: delete old token
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const userId = payload.sub as string;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'User not found');
  }

  const newAccessToken = signAccessToken(user.id, user.email);
  const newRefreshToken = signRefreshToken(user.id);
  await storeRefreshToken(newRefreshToken, user.id);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logoutUser(refreshToken: string) {
  // Idempotent: no error if token not found
  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken },
  });
}
