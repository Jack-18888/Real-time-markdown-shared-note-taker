import request from 'supertest';
import http from 'http';
import WebSocket from 'ws';
import { createApp, createServer } from '../index';
import { cleanDatabase, createAuthenticatedUser, clearWsState } from './helpers';

const app = createApp();
let server: http.Server;
let serverAddress: string;

beforeAll((done) => {
  server = createServer(app);
  server.listen(0, () => {
    const addr = server.address() as { port: number };
    serverAddress = `ws://127.0.0.1:${addr.port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
}, 15000);

beforeEach(async () => {
  await cleanDatabase();
  clearWsState();
});

/**
 * Helper: connect a WebSocket client with the given token.
 * Resolves when the connection is open; rejects on error or close.
 */
function connectWs(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${serverAddress}/ws?token=${token}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
    ws.on('close', (code, reason) => reject(new Error(`WS closed: ${code} ${reason}`)));
  });
}

/**
 * Helper: connect a WebSocket client that we expect to be closed immediately.
 * Resolves with the close code.
 */
function connectWsExpectClose(token?: string): Promise<number> {
  return new Promise((resolve) => {
    const url = token
      ? `${serverAddress}/ws?token=${token}`
      : `${serverAddress}/ws`;
    const ws = new WebSocket(url);
    ws.on('close', (code) => resolve(code));
    ws.on('error', () => { /* suppress */ });
  });
}

/**
 * Helper: wait for the next message matching a specific event name.
 */
function waitForEvent(ws: WebSocket, eventName: string, timeoutMs = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${eventName}"`));
    }, timeoutMs);

    const handler = (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === eventName) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg.payload);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Helper: send an event via WebSocket.
 */
function sendEvent(ws: WebSocket, event: string, payload: Record<string, unknown>) {
  ws.send(JSON.stringify({ event, payload }));
}

/**
 * Helper: collect all messages received during a timeout window.
 */
function collectMessages(ws: WebSocket, durationMs = 500): Promise<any[]> {
  return new Promise((resolve) => {
    const messages: any[] = [];
    const handler = (data: WebSocket.Data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch { /* ignore */ }
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.off('message', handler);
      resolve(messages);
    }, durationMs);
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });
}

describe('WebSocket connection authentication', () => {
  it('should accept connection with valid access token', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const ws = await connectWs(alice.accessToken);

    expect(ws.readyState).toBe(WebSocket.OPEN);
    await closeWs(ws);
  });

  it('should reject connection with invalid token (close code 4001)', async () => {
    const code = await connectWsExpectClose('invalid-token-string');
    expect(code).toBe(4001);
  });

  it('should reject connection with no token (close code 4001)', async () => {
    const code = await connectWsExpectClose();
    expect(code).toBe(4001);
  });
});

describe('note:join', () => {
  it('should receive note:joined with content and collaborators on valid join', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Test Note', content: '# Hello' });

    const ws = await connectWs(alice.accessToken);
    const joinedPromise = waitForEvent(ws, 'note:joined');

    sendEvent(ws, 'note:join', { noteId: note.body.id });

    const payload = await joinedPromise;
    expect(payload.noteId).toBe(note.body.id);
    expect(payload.content).toBe('# Hello');
    expect(payload.collaborators).toContain(alice.user.id);

    await closeWs(ws);
  });

  it('should receive note:error FORBIDDEN when user has no access', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Private', content: 'secret' });

    const ws = await connectWs(bob.accessToken);
    const errorPromise = waitForEvent(ws, 'note:error');

    sendEvent(ws, 'note:join', { noteId: note.body.id });

    const payload = await errorPromise;
    expect(payload.code).toBe('FORBIDDEN');

    await closeWs(ws);
  });

  it('should receive note:error NOT_FOUND when note does not exist', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const ws = await connectWs(alice.accessToken);
    const errorPromise = waitForEvent(ws, 'note:error');

    sendEvent(ws, 'note:join', { noteId: '00000000-0000-0000-0000-000000000000' });

    const payload = await errorPromise;
    expect(payload.code).toBe('NOT_FOUND');

    await closeWs(ws);
  });

  it('should allow join with read access (shared note)', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');
    const bob = await createAuthenticatedUser(app, 'bob@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Shared', content: 'content' });

    await request(app)
      .post(`/api/notes/${note.body.id}/shares`)
      .set('Authorization', alice.authHeader)
      .send({ email: 'bob@example.com', permission: 'read' });

    const ws = await connectWs(bob.accessToken);
    const joinedPromise = waitForEvent(ws, 'note:joined');

    sendEvent(ws, 'note:join', { noteId: note.body.id });

    const payload = await joinedPromise;
    expect(payload.noteId).toBe(note.body.id);
    expect(payload.content).toBe('content');

    await closeWs(ws);
  });
});

describe('note:leave', () => {
  it('should broadcast presence update when user leaves', async () => {
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

    // Alice joins
    const wsAlice = await connectWs(alice.accessToken);
    const aliceJoinP = waitForEvent(wsAlice, 'note:joined');
    sendEvent(wsAlice, 'note:join', { noteId: note.body.id });
    await aliceJoinP;

    // Bob joins
    const wsBob = await connectWs(bob.accessToken);
    const bobJoinP = waitForEvent(wsBob, 'note:joined');
    const alicePresenceP = waitForEvent(wsAlice, 'note:presence');
    sendEvent(wsBob, 'note:join', { noteId: note.body.id });
    await bobJoinP;
    await alicePresenceP;

    // Now Bob leaves — Alice should get a presence update
    const alicePresence2 = waitForEvent(wsAlice, 'note:presence');
    sendEvent(wsBob, 'note:leave', { noteId: note.body.id });

    const presencePayload = await alicePresence2;
    expect(presencePayload.noteId).toBe(note.body.id);
    expect(presencePayload.collaborators).toContain(alice.user.id);
    expect(presencePayload.collaborators).not.toContain(bob.user.id);

    await closeWs(wsAlice);
    await closeWs(wsBob);
  });
});

describe('note:update', () => {
  it('should save content to DB and broadcast to other clients (not sender)', async () => {
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

    // Both join
    const wsAlice = await connectWs(alice.accessToken);
    const aliceJoinP = waitForEvent(wsAlice, 'note:joined');
    sendEvent(wsAlice, 'note:join', { noteId: note.body.id });
    await aliceJoinP;

    const wsBob = await connectWs(bob.accessToken);
    const bobJoinP = waitForEvent(wsBob, 'note:joined');
    sendEvent(wsBob, 'note:join', { noteId: note.body.id });
    await bobJoinP;

    // Consume the presence events that arrived from Bob joining
    // (Alice gets presence, Bob gets joined — already consumed by bobJoinP)
    // Give a brief moment for presence event to arrive at Alice
    await new Promise((r) => setTimeout(r, 100));

    // Bob sends an update — Alice should get note:updated, Bob should NOT
    const aliceUpdateP = waitForEvent(wsAlice, 'note:updated');
    const bobMessages = collectMessages(wsBob, 1000);

    sendEvent(wsBob, 'note:update', { noteId: note.body.id, content: 'edited by bob' });

    const updatePayload = await aliceUpdateP;
    expect(updatePayload.noteId).toBe(note.body.id);
    expect(updatePayload.content).toBe('edited by bob');
    expect(updatePayload.updatedBy).toBe(bob.user.id);

    // Verify Bob did NOT receive note:updated
    const bobMsgs = await bobMessages;
    const updateEchos = bobMsgs.filter((m) => m.event === 'note:updated');
    expect(updateEchos).toHaveLength(0);

    // Verify content was saved in DB via REST API
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(getRes.body.content).toBe('edited by bob');

    await closeWs(wsAlice);
    await closeWs(wsBob);
  });

  it('should return note:error FORBIDDEN for read-only user', async () => {
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

    const wsBob = await connectWs(bob.accessToken);
    const bobJoinP = waitForEvent(wsBob, 'note:joined');
    sendEvent(wsBob, 'note:join', { noteId: note.body.id });
    await bobJoinP;

    // Bob tries to update with read-only access
    const errorP = waitForEvent(wsBob, 'note:error');
    sendEvent(wsBob, 'note:update', { noteId: note.body.id, content: 'hack attempt' });

    const errorPayload = await errorP;
    expect(errorPayload.code).toBe('FORBIDDEN');

    // Verify DB was not modified
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(getRes.body.content).toBe('original');

    await closeWs(wsBob);
  });

  it('owner should be able to update via WebSocket', async () => {
    const alice = await createAuthenticatedUser(app, 'alice@example.com');

    const note = await request(app)
      .post('/api/notes')
      .set('Authorization', alice.authHeader)
      .send({ title: 'Note', content: 'original' });

    const wsAlice = await connectWs(alice.accessToken);
    const joinP = waitForEvent(wsAlice, 'note:joined');
    sendEvent(wsAlice, 'note:join', { noteId: note.body.id });
    await joinP;

    sendEvent(wsAlice, 'note:update', { noteId: note.body.id, content: 'owner edited' });

    // Wait a bit for the DB write to complete
    await new Promise((r) => setTimeout(r, 300));

    // Verify content saved
    const getRes = await request(app)
      .get(`/api/notes/${note.body.id}`)
      .set('Authorization', alice.authHeader);

    expect(getRes.body.content).toBe('owner edited');

    await closeWs(wsAlice);
  });
});

describe('Presence (multi-client)', () => {
  it('both clients see each other in collaborators when second user joins', async () => {
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

    // Alice joins
    const wsAlice = await connectWs(alice.accessToken);
    const aliceJoinP = waitForEvent(wsAlice, 'note:joined');
    sendEvent(wsAlice, 'note:join', { noteId: note.body.id });
    const aliceJoined = await aliceJoinP;

    // Alice should initially be alone
    expect(aliceJoined.collaborators).toEqual([alice.user.id]);

    // Bob joins — Alice should receive presence, Bob should get joined with both users
    const alicePresenceP = waitForEvent(wsAlice, 'note:presence');
    const wsBob = await connectWs(bob.accessToken);
    const bobJoinP = waitForEvent(wsBob, 'note:joined');
    sendEvent(wsBob, 'note:join', { noteId: note.body.id });

    const bobJoined = await bobJoinP;
    const alicePresence = await alicePresenceP;

    // Bob's joined response should list both collaborators
    expect(bobJoined.collaborators).toContain(alice.user.id);
    expect(bobJoined.collaborators).toContain(bob.user.id);

    // Alice's presence update should list both
    expect(alicePresence.collaborators).toContain(alice.user.id);
    expect(alicePresence.collaborators).toContain(bob.user.id);

    await closeWs(wsAlice);
    await closeWs(wsBob);
  });

  it('remaining clients receive presence update when a user disconnects abruptly', async () => {
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

    // Both join
    const wsAlice = await connectWs(alice.accessToken);
    const aliceJoinP = waitForEvent(wsAlice, 'note:joined');
    sendEvent(wsAlice, 'note:join', { noteId: note.body.id });
    await aliceJoinP;

    const wsBob = await connectWs(bob.accessToken);
    const bobJoinP = waitForEvent(wsBob, 'note:joined');
    sendEvent(wsBob, 'note:join', { noteId: note.body.id });
    await bobJoinP;

    // Consume the presence event Alice got from Bob joining
    await new Promise((r) => setTimeout(r, 100));

    // Bob disconnects abruptly — Alice should get a presence update
    const alicePresenceP = waitForEvent(wsAlice, 'note:presence');
    wsBob.terminate(); // Abrupt disconnect

    const presencePayload = await alicePresenceP;
    expect(presencePayload.noteId).toBe(note.body.id);
    expect(presencePayload.collaborators).toContain(alice.user.id);
    expect(presencePayload.collaborators).not.toContain(bob.user.id);

    await closeWs(wsAlice);
  });
});
