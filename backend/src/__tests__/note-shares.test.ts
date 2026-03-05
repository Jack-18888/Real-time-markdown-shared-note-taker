import request from 'supertest';
import { createApp } from '../index';
import { cleanDatabase, createAuthenticatedUser } from './helpers';

const app = createApp();

beforeEach(async () => {
  await cleanDatabase();
});

describe('GET /api/notes/:id/shares', () => {
  it('should return share list for owner (200)', async () => {
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
      .get(`/api/notes/${note.body.id}/shares`)
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

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const res = await request(app)
      .get(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });

  it('should return 401 if unauthenticated', async () => {
    const res = await request(app).get('/api/notes/some-id/shares');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/notes/:id/shares', () => {
  it('should share a note with another user (201)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'My Note', content: 'content' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('bob@example.com');
    expect(res.body.permission).toBe('read');
  });

  it('should return 404 if target email not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'nobody@example.com', permission: 'read' });

    expect(res.status).toBe(404);
  });

  it('should return 409 if already shared', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('should return 403 if requester is not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');
    await createAuthenticatedUser(app, 'charlie@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', bob.authHeader)
      .send({ email: 'charlie@example.com', permission: 'read' });

    expect(res.status).toBe(403);
  });

  it('should reject sharing with yourself (owner)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'alice@example.com', permission: 'read' });

    expect(res.status).toBe(400);
  });

  it('should return 400 if required fields are missing', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com' }); // missing permission

    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/notes/:id/shares/:userId', () => {
  it('should update share permission (200)', async () => {
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
      .patch(`/api/notes/${note.body.id}/shares/${bob.user.id}`)
      .set('Authorization', alice.authHeader)
      .send({ permission: 'write' });

    expect(res.status).toBe(200);
    expect(res.body.permission).toBe('write');
  });

  it('should return 404 if share not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .patch(`/api/notes/${note.body.id}/shares/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', alice.authHeader)
      .send({ permission: 'write' });

    expect(res.status).toBe(404);
  });

  it('should return 403 if not owner', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');
    const charlie = await createAuthenticatedUser(app, 'charlie@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    // Bob (non-owner with write access) tries to update
    const res = await request(app)
      .patch(`/api/notes/${note.body.id}/shares/${charlie.user.id}`)
      .set('Authorization', bob.authHeader)
      .send({ permission: 'read' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/notes/:id/shares/:userId', () => {
  it('should remove share and return 204', async () => {
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
      .delete(`/api/notes/${note.body.id}/shares/${bob.user.id}`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(204);

    // Verify Bob can no longer access the note
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(getRes.status).toBe(403);
  });

  it('should return 404 if share not found', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'content' });

    const res = await request(app)
      .delete(`/api/notes/${note.body.id}/shares/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', alice.authHeader);

    expect(res.status).toBe(404);
  });

  it('should return 403 if not owner', async () => {
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
      .delete(`/api/notes/${note.body.id}/shares/${bob.user.id}`)
      .set('Authorization', bob.authHeader);

    expect(res.status).toBe(403);
  });
});

describe('Permission resolution edge cases', () => {
  it('direct NoteShare (write) overrides FolderShare (read)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Folder' });

    // Give Bob read-only folder access
    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original', folderId: folder.body.id });

    // Give Bob direct write access to the note
    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    // Bob should be able to edit (direct write overrides folder read)
    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'edited by bob' });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe('edited by bob');

    // Verify permission in GET is 'write' from direct share
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(getRes.body.permission).toBe('write');
  });

  it('direct NoteShare (read) overrides FolderShare (write)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Folder' });

    // Give Bob write folder access
    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original', folderId: folder.body.id });

    // Give Bob direct read-only access to the note (more restrictive)
    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    // Bob should NOT be able to edit (direct read overrides folder write)
    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'attempt edit' });

    expect(res.status).toBe(403);

    // Verify permission in GET is 'read' from direct share
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(getRes.body.permission).toBe('read');
  });

  it('user with only FolderShare gets folder permission on the note', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const folder = await request(app)
      .post('/api/folders')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Folder' });

    await request(app)
      .post(`/api/folders/${folder.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'write' });

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original', folderId: folder.body.id });

    // No direct NoteShare — Bob relies on FolderShare
    const res = await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader)
      .send({ content: 'edited via folder share' });

    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(getRes.body.permission).toBe('write');
  });

  it('note moved out of shared folder loses folder-based access', async () => {
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
      .send({ title: 'Note', content: 'content', folderId: folder.body.id });

    // Verify Bob has access while note is in shared folder
    const beforeRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(beforeRes.status).toBe(200);

    // Alice moves note out of the folder (to root)
    await request(app)
      .patch(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader)
      .send({ folderId: null });

    // Bob should now lose access (no direct NoteShare, no folder share)
    const afterRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', bob.authHeader);

    expect(afterRes.status).toBe(403);
  });
});
