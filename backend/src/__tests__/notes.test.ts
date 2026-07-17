import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/notes', () => {
  it('should return owned notes without content field (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note 1', content: '# Hello' });

    await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note 2', content: '# World' });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('permission', 'owner');
    expect(res.body[0]).not.toHaveProperty('content');
    expect(res.body[1]).not.toHaveProperty('content');
  });

  it('should return notes shared via NoteShare with correct permission', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Shared Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(note.body.id);
    expect(res.body[0].permission).toBe('write');
    expect(res.body[0]).not.toHaveProperty('content');
  });

  it('should return notes shared via FolderShare with correct permission', async () => {
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

    await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Folder Note', content: 'content', folderId: folder.body.id });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Folder Note');
    expect(res.body[0].permission).toBe('read');
  });

  it('should filter by folderId when provided', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'In Folder', content: 'content', folderId: folder.body.id });

    await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Root Note', content: 'content' });

    const res = await request(app)
      .get('/api/notes')
      .set('Authorization', alice.authHeader)
      .query({ folderId: folder.body.id });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('In Folder');
  });

  it('should return 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/notes');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/notes', () => {
  it('should create a note with content (201)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'My Note', content: '# Hello\nMarkdown here.' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('My Note');
    expect(res.body.content).toBe('# Hello\nMarkdown here.');
    expect(res.body.ownerId).toBe(alice.user.id);
    expect(res.body.folderId).toBeNull();
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('should create a note inside a folder (201)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'My Folder' });

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Folder Note', content: 'content', folderId: folder.body.id });

    expect(res.status).toBe(201);
    expect(res.body.folderId).toBe(folder.body.id);
  });

  it('should return 400 if title is missing', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ content: 'no title' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 403 if user has no write access to the folder', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Alice Folder' });

    // Share with read-only access
    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', bob.authHeader)
      .send({ title: 'Bob Note', content: 'content', folderId: folder.body.id });

    expect(res.status).toBe(403);
  });

  it('should return 404 if folderId does not exist', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content', folderId: '00000000-0000-0000-0000-000000000000' });

    expect(res.status).toBe(404);
  });

  it('should return 403 if user has no access at all to the folder', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Alice Folder' });

    // Bob has no share at all
    const res = await request(app)
      .post('/api/notes')
      .set('Authorization', bob.authHeader)
      .send({ title: 'Bob Note', content: 'content', folderId: folder.body.id });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/notes/:id', () => {
  it('should return note with content and permission for owner (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'My Note', content: '# Content' });

    const res = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(note.body.id);
    expect(res.body.title).toBe('My Note');
    expect(res.body.content).toBe('# Content');
    expect(res.body.permission).toBe('owner');
  });

  it('should return note with permission for shared user (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Shared Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('content');
    expect(res.body.permission).toBe('read');
  });

  it('should return 403 if user has no access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Private', content: 'secret' });

    const res = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 404 if note not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .get('/api/notes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/notes/:id', () => {
  it('should update note by owner (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Original', content: 'original content' });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader)
      .send({ title: 'Updated', content: 'updated content' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.content).toBe('updated content');
  });

  it('should update note by user with write NoteShare (200)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'edited by bob' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('edited by bob');
  });

  it('should update note by user with write FolderShare (200)', async () => {
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

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Folder Note', content: 'original', folderId: folder.body.id });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'edited by bob via folder share' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('edited by bob via folder share');
  });

  it('should return 403 if user has only read access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'attempt edit' });

    expect(res.status).toBe(403);
  });

  it('should return 403 if user has no access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Private Note', content: 'secret' });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'hack attempt' });

    expect(res.status).toBe(403);
  });

  it('should return 404 if note not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .patch('/api/notes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('should allow moving a note to a different folder', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const folder1 = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Folder 1' });

    const folder2 = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Folder 2' });

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content', folderId: folder1.body.id });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader)
      .send({ folderId: folder2.body.id });

    expect(res.status).toBe(200);
    expect(res.body.folderId).toBe(folder2.body.id);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('should delete note by owner (204)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'To Delete', content: 'content' });

    const res = await request(app)
      .delete(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(204);

    // Verify it's actually gone
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(getRes.status).toBe(404);
  });

  it('should return 403 if user has write access but is not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .delete(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 403 if user has read access only', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .delete(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 404 if note not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const res = await request(app)
      .delete('/api/notes/00000000-0000-0000-0000-000000000000')
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(404);
  });
});
