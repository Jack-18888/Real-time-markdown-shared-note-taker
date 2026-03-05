import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/users/me', () => {
  it('should return the authenticated user profile', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('alice@example.com');
    expect(res.body.createdAt).toBeDefined();
    // Password should never be returned
    expect(res.body.password).toBeUndefined();
  });

  it('should return 401 if not authenticated', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});

describe('GET /api/users/search', () => {
  it('should return user for exact email match', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');
    // Register a second user to search for
    await createAuthenticatedUser(app, 'bob@example.com');

    const res = await request(app)
      .get('/api/users/search')
      .query({ email: 'bob@example.com' })
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('bob@example.com');
    // Should not return password
    expect(res.body.password).toBeUndefined();
  });

  it('should return 404 when no user matches the email', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .get('/api/users/search')
      .query({ email: 'nobody@example.com' })
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 404 for partial email match (no fuzzy search)', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .get('/api/users/search')
      .query({ email: 'alice' })
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 400 when email query param is missing', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .get('/api/users/search')
      .set('Authorization', authHeader);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 if not authenticated', async () => {
    const res = await request(app)
      .get('/api/users/search')
      .query({ email: 'alice@example.com' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
