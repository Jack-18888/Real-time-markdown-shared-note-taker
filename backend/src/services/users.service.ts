import { prisma } from '../lib/prisma';
import { AppError } from '../types';

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
}

export async function searchUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
}
