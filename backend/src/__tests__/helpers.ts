import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../lib/prisma';
import { getClients, getNoteRooms, getWsToUser } from '../websocket/server';

/**
 * Register a new user and return their tokens and user info.
 */
export async function registerUser(
  app: Express,
  email: string,
  password: string
) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password });
  return res;
}

/**
 * Login a user and return their tokens and user info.
 */
export async function loginUser(
  app: Express,
  email: string,
  password: string
) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  return res;
}

/**
 * Register a user and return a convenience object with their info and auth header.
 */
export async function createAuthenticatedUser(
  app: Express,
  email: string,
  password: string = 'password123'
) {
  const res = await registerUser(app, email, password);
  return {
    user: res.body.user,
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
    authHeader: `Bearer ${res.body.accessToken}`,
  };
}

/**
 * Clean all data from the test database between test suites.
 */
export async function cleanDatabase() {
  await prisma.noteShare.deleteMany();
  await prisma.folderShare.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.note.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Clear WebSocket in-memory state between tests.
 */
export function clearWsState() {
  const clients = getClients();
  const noteRooms = getNoteRooms();
  const wsToUser = getWsToUser();
  clients.clear();
  noteRooms.clear();
  wsToUser.clear();
}
