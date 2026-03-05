import { WebSocket } from 'ws';
import { getNoteRooms, broadcastToRoom, sendToSocket } from './server';

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
      // Will be implemented in BE-13
      break;
    case 'note:leave':
      // Will be implemented in BE-13
      break;
    case 'note:update':
      // Will be implemented in BE-13
      break;
    default:
      // Unknown event — silently ignore
      break;
  }
}
