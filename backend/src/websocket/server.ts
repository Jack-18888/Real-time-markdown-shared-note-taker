import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import { handleMessage } from './handlers';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

// userId → Set of connected WebSocket clients
const clients = new Map<string, Set<WebSocket>>();

// noteId → Set of userIds currently in the room
const noteRooms = new Map<string, Set<string>>();

// Reverse mapping: ws → userId (for cleanup on disconnect)
const wsToUser = new Map<WebSocket, string>();

export function getClients() {
  return clients;
}

export function getNoteRooms() {
  return noteRooms;
}

export function getWsToUser() {
  return wsToUser;
}

export function getUserSockets(userId: string): Set<WebSocket> {
  return clients.get(userId) ?? new Set();
}

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    // Extract token from query string
    const parsedUrl = url.parse(req.url || '', true);
    const token = parsedUrl.query.token as string | undefined;

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, ACCESS_SECRET) as jwt.JwtPayload;
    } catch {
      ws.close(4001, 'Invalid authentication token');
      return;
    }

    const userId = payload.sub as string;

    // Register client
    wsToUser.set(ws, userId);
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);

    // Handle messages
    ws.on('message', (rawMessage) => {
      handleMessage(ws, userId, rawMessage.toString());
    });

    // Handle disconnect
    ws.on('close', () => {
      // Remove from clients map
      const userSockets = clients.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(userId);
        }
      }
      wsToUser.delete(ws);

      // Remove from all note rooms and broadcast presence
      for (const [noteId, userIds] of noteRooms.entries()) {
        if (userIds.has(userId)) {
          // Only remove if user has no other active connections in this room
          const remainingSockets = clients.get(userId);
          if (!remainingSockets || remainingSockets.size === 0) {
            userIds.delete(userId);
            if (userIds.size === 0) {
              noteRooms.delete(noteId);
            } else {
              broadcastToRoom(noteId, userId, {
                event: 'note:presence',
                payload: {
                  noteId,
                  collaborators: Array.from(userIds),
                },
              });
            }
          }
        }
      }
    });
  });

  return wss;
}

export function broadcastToRoom(
  noteId: string,
  excludeUserId: string | null,
  message: object
) {
  const userIds = noteRooms.get(noteId);
  if (!userIds) return;

  const data = JSON.stringify(message);

  for (const uid of userIds) {
    if (uid === excludeUserId) continue;
    const sockets = clients.get(uid);
    if (!sockets) continue;

    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch {
          // Dead socket — will be cleaned up on close event
        }
      }
    }
  }
}

export function sendToSocket(ws: WebSocket, message: object) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Ignore send errors on dead sockets
    }
  }
}
