import { WebSocket } from 'ws';
import { prisma } from '../lib/prisma';
import { resolveNotePermission } from '../services/permissions';
import {
  getNoteRooms,
  getUserSockets,
  broadcastToRoom,
  sendToSocket,
} from './server';

interface WsMessage {
  event: string;
  payload: Record<string, unknown>;
}

export function handleMessage(ws: WebSocket, userId: string, rawMessage: string) {
  let message: WsMessage;
  try {
    message = JSON.parse(rawMessage);
  } catch {
    // Silently ignore invalid JSON
    return;
  }

  if (!message.event || typeof message.event !== 'string') {
    // Silently ignore messages without event field
    return;
  }

  switch (message.event) {
    case 'note:join':
      handleNoteJoin(ws, userId, message.payload);
      break;
    case 'note:leave':
      handleNoteLeave(ws, userId, message.payload);
      break;
    case 'note:update':
      handleNoteUpdate(ws, userId, message.payload);
      break;
    default:
      // Unknown event — silently ignore
      break;
  }
}

async function handleNoteJoin(
  ws: WebSocket,
  userId: string,
  payload: Record<string, unknown>
) {
  const noteId = payload.noteId as string;
  if (!noteId) return;

  // Check if note exists
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, content: true },
  });

  if (!note) {
    sendToSocket(ws, {
      event: 'note:error',
      payload: { code: 'NOT_FOUND', message: 'Note not found' },
    });
    return;
  }

  // Check permission
  const permission = await resolveNotePermission(noteId, userId);
  if (!permission) {
    sendToSocket(ws, {
      event: 'note:error',
      payload: { code: 'FORBIDDEN', message: 'You do not have access to this note' },
    });
    return;
  }

  // Add user to the note room
  const noteRooms = getNoteRooms();
  if (!noteRooms.has(noteId)) {
    noteRooms.set(noteId, new Set());
  }
  noteRooms.get(noteId)!.add(userId);

  const collaborators = Array.from(noteRooms.get(noteId)!);

  // Send joined acknowledgement to the connecting client
  sendToSocket(ws, {
    event: 'note:joined',
    payload: {
      noteId,
      content: note.content,
      collaborators,
    },
  });

  // Broadcast presence update to other clients in the room
  broadcastToRoom(noteId, userId, {
    event: 'note:presence',
    payload: {
      noteId,
      collaborators,
    },
  });
}

async function handleNoteLeave(
  _ws: WebSocket,
  userId: string,
  payload: Record<string, unknown>
) {
  const noteId = payload.noteId as string;
  if (!noteId) return;

  const noteRooms = getNoteRooms();
  const room = noteRooms.get(noteId);
  if (!room) return;

  room.delete(userId);

  if (room.size === 0) {
    noteRooms.delete(noteId);
  } else {
    // Broadcast presence update to remaining members
    broadcastToRoom(noteId, null, {
      event: 'note:presence',
      payload: {
        noteId,
        collaborators: Array.from(room),
      },
    });
  }
}

async function handleNoteUpdate(
  ws: WebSocket,
  userId: string,
  payload: Record<string, unknown>
) {
  const noteId = payload.noteId as string;
  const content = payload.content as string;
  if (!noteId || content === undefined) return;

  // Check permission — must have write access
  const permission = await resolveNotePermission(noteId, userId);
  if (!permission || permission === 'read') {
    sendToSocket(ws, {
      event: 'note:error',
      payload: { code: 'FORBIDDEN', message: 'You do not have write access to this note' },
    });
    return;
  }

  // Save to database
  await prisma.note.update({
    where: { id: noteId },
    data: { content },
  });

  // Broadcast to all other clients in the room (not back to sender)
  broadcastToRoom(noteId, userId, {
    event: 'note:updated',
    payload: {
      noteId,
      content,
      updatedBy: userId,
    },
  });
}
