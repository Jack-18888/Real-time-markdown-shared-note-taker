import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/folders/:id/shares', () => {
  it('should return share list for owner (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Shared Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .get(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].email).toBe('bob@example.com');
    expect(res.body[0].permission).toBe('read');
    expect(res.body[0].userId).toBe(bob.user.id);
  });

  it('should return 403 for non-owner (even write-access user)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Shared Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .get(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/folders/some-id/shares');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/folders/:id/shares', () => {
  it('should share a folder with another user (201)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('bob@example.com');
    expect(res.body.permission).toBe('read');
  });

  it('should return 404 if target email not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'nobody@example.com', permission: 'read' });

    expect(res.status).toBe(404);
  });

  it('should return 409 if already shared', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('should return 403 if requester is not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');
    await createAuthenticatedUser(app, 'charlie@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', bob.authHeader)
      .send({ email: 'charlie@example.com', permission: 'read' });

    expect(res.status).toBe(403);
  });

  it('should reject sharing with yourself (owner)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'alice@example.com', permission: 'read' });

    expect(res.status).toBe(400);
  });

  it('should return 400 if required fields are missing', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com' }); // missing permission

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/folders/:id/shares/:userId', () => {
  it('should update share permission (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .patch(`/api/folders/${folder.body.id}/shares/${bob.user.id}`)
      .set('Authorization', alice.authHeader)
      .send({ permission: 'write' });

    expect(res.status).toBe(200);
    expect(res.body.permission).toBe('write');
  });

  it('should return 404 if share not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .patch(`/api/folders/${folder.body.id}/shares/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', alice.authHeader)
      .send({ permission: 'write' });

    expect(res.status).toBe(404);
  });

  it('should return 403 if not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');
    const charlie = await createAuthenticatedUser(app, 'charlie@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    // Bob (non-owner with write access) tries to update Charlie's share
    const res = await request(app)
      .patch(`/api/folders/${folder.body.id}/shares/${charlie.user.id}`)
      .set('Authorization', bob.authHeader)
      .send({ permission: 'read' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/folders/:id/shares/:userId', () => {
  it('should remove share and return 204', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .delete(`/api/folders/${folder.body.id}/shares/${bob.user.id}`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(204);
  });

  it('should return 404 if share not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .delete(`/api/folders/${folder.body.id}/shares/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(404);
  });

  it('should return 403 if not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .delete(`/api/folders/${folder.body.id}/shares/${bob.user.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });
});

describe('Cross-feature: folder sharing effects', () => {
  it('user with read FolderShare can see folder in GET /api/folders', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Shared Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .get('/api/folders')
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(200);
    const shared = res.body.find((f: any) => f.id === folder.body.id);
    expect(shared).toBeDefined();
    expect(shared.permission).toBe('read');
  });

  it('user with write FolderShare can create a note inside that folder', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Shared Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', bob.authHeader)
      .send({ title: 'Bob Note', content: 'content', folderId: folder.body.id });

    expect(res.status).toBe(201);
    expect(res.body.folderId).toBe(folder.body.id);
  });
});
