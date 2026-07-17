import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser } from './helpers';
import { prisma } from '../lib/prisma';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/folders', () => {
  it('should return owned folders', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    // Create a folder
    await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .get('/api/folders')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('My Folder');
    expect(res.body[0].permission).toBe('owner');
  });

  it('should return shared folders with correct permission', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    // Alice creates a folder
    const folderRes = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Shared Folder' });

    // Alice shares with Bob (read)
    await request(app)
      .post(`/api/folders/${folderRes.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    // Bob should see the shared folder
    const res = await request(app)
      .get('/api/folders')
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(200);
    const sharedFolder = res.body.find((f: any) => f.name === 'Shared Folder');
    expect(sharedFolder).toBeDefined();
    expect(sharedFolder.permission).toBe('read');
  });

  it('should return 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/folders');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/folders', () => {
  it('should create a root folder (no parentId) with 201', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'My Folder' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('My Folder');
    expect(res.body.parentId).toBeNull();
  });

  it('should create a nested folder when parent exists', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const parent = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Parent' });

    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Child', parentId: parent.body.id });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Child');
    expect(res.body.parentId).toBe(parent.body.id);
  });

  it('should return 403 if creating inside a folder with only read access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    // Alice creates a folder
    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Alice Folder' });

    // Share with bob as read
    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    // Bob tries to create a subfolder
    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', bob.authHeader)
      .send({ name: 'Sub Folder', parentId: folder.body.id });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('should return 404 if parentId does not exist', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Child', parentId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('should return 400 if name is missing', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/folders/:id', () => {
  it('should rename a folder by owner (200)', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Old Name' });

    const res = await request(app)
      .patch(`/api/folders/${folder.body.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('should move a folder to a new parent by owner', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const folderA = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Folder A' });

    const folderB = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Folder B' });

    const res = await request(app)
      .patch(`/api/folders/${folderB.body.id}`)
      .set('Authorization', authHeader)
      .send({ parentId: folderA.body.id });

    expect(res.status).toBe(200);
    expect(res.body.parentId).toBe(folderA.body.id);
  });

  it('should return 403 if not owner and no write access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Alice Folder' });

    const res = await request(app)
      .patch(`/api/folders/${folder.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('should return 404 if folder not found', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .patch('/api/folders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader)
      .send({ name: 'New Name' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/folders/:id', () => {
  it('should delete a folder and return 204', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'To Delete' });

    const res = await request(app)
      .delete(`/api/folders/${folder.body.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);

    // Verify folder is actually gone
    const check = await prisma.folder.findUnique({ where: { id: folder.body.id } });
    expect(check).toBeNull();
  });

  it('should recursively delete child folders and notes', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    // Create parent folder
    const parent = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Parent' });

    // Create child folder inside parent
    const child = await request(app)
      .post('/api/folders')
      .set('Authorization', authHeader)
      .send({ name: 'Child', parentId: parent.body.id });

    // Create a note inside parent folder
    await request(app)
      .post('/api/notes')
      .set('Authorization', authHeader)
      .send({ title: 'Note in Parent', content: 'content', folderId: parent.body.id });

    // Create a note inside child folder
    await request(app)
      .post('/api/notes')
      .set('Authorization', authHeader)
      .send({ title: 'Note in Child', content: 'content', folderId: child.body.id });

    // Delete parent
    const res = await request(app)
      .delete(`/api/folders/${parent.body.id}`)
      .set('Authorization', authHeader);

    expect(res.status).toBe(204);

    // Verify child folder is deleted
    const childCheck = await prisma.folder.findUnique({ where: { id: child.body.id } });
    expect(childCheck).toBeNull();

    // Verify notes in those folders are deleted
    const notesInParent = await prisma.note.findMany({
      where: { folderId: parent.body.id },
    });
    expect(notesInParent).toHaveLength(0);

    const notesInChild = await prisma.note.findMany({
      where: { folderId: child.body.id },
    });
    expect(notesInChild).toHaveLength(0);
  });

  it('should return 403 if not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Alice Folder' });

    // Share with bob (write)
    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    // Bob tries to delete (should fail — only owner can delete)
    const res = await request(app)
      .delete(`/api/folders/${folder.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 404 if folder not found', async () => {
    const { authHeader } = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .delete('/api/folders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', authHeader);

    expect(res.status).toBe(404);
  });

  it('should return 401 if unauthenticated', async () => {
    const res = await request(app).delete('/api/folders/some-id');
    expect(res.status).toBe(401);
  });
});
