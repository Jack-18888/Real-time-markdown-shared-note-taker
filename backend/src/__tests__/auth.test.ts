import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser, registerUser, loginUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('POST /api/auth/register', () => {
  it('should register a new user and return 201 with tokens', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // Password should never be in the response
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when password is less than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 409 when email is already in use', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password456' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });
  });

  it('should login successfully and return 200 with tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('should return 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 for unknown email (same message as wrong password)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/refresh', () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });
    refreshToken = res.body.refreshToken;
  });

  it('should return 200 with new tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    // New refresh token should be different (rotation)
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('should invalidate the old refresh token after rotation', async () => {
    // Use the refresh token once
    await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    // Try to use the old refresh token again
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 for invalid token string', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid-token-string' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 when refreshToken is missing', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/logout', () => {
  let refreshToken: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' });
    refreshToken = res.body.refreshToken;
  });

  it('should return 204 on successful logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });

    expect(res.status).toBe(204);
  });

  it('should be idempotent (second logout does not error)', async () => {
    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });

    expect(res.status).toBe(204);
  });

  it('should invalidate the refresh token (cannot refresh after logout)', async () => {
    await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(401);
  });
});

describe('Protected routes with auth', () => {
  it('should return 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 when token is malformed', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer not-a-valid-jwt');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 when Authorization header has wrong format', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'NotBearer sometoken');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('should return 200 when valid token is provided', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'test@example.com');

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });
});
