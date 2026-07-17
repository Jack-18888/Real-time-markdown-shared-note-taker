import { ref, onUnmounted } from 'vue';
import { useAuthStore } from '@/stores/auth';

type EventHandler = (payload: unknown) => void;
type ConnectCallback = () => void;

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000/ws';
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const authStore = useAuthStore();
  const connected = ref(false);

  let ws: WebSocket | null = null;
  let handlers: Map<string, Set<EventHandler>> = new Map();
  let connectCallbacks: Set<ConnectCallback> = new Set();
  let pendingMessages: string[] = [];
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let shouldReconnect = true;

  function connect() {
    const token = authStore.accessToken;
    if (!token) return;

    try {
      ws = new WebSocket(`${WS_BASE_URL}?token=${token}`);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected.value = true;
      reconnectAttempts = 0;

      // Flush any messages that were queued while disconnected
      for (const msg of pendingMessages) {
        ws!.send(msg);
      }
      pendingMessages = [];

      // Notify consumers so they can re-join rooms, etc.
      for (const cb of connectCallbacks) {
        cb();
      }
    };

    ws.onclose = () => {
      connected.value = false;
      ws = null;
      if (shouldReconnect) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg && typeof msg.event === 'string') {
          const eventHandlers = handlers.get(msg.event);
          if (eventHandlers) {
            eventHandlers.forEach((handler) => handler(msg.payload));
          }
        }
      } catch {
        // Silently ignore invalid JSON
      }
    };
  }

  function scheduleReconnect() {
    if (!shouldReconnect) return;
    if (reconnectTimer) return;

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function send(event: string, payload: unknown) {
    const data = JSON.stringify({ event, payload });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    } else {
      // Queue the message — it will be flushed when the socket opens
      pendingMessages.push(data);
    }
  }

  function on(event: string, handler: EventHandler) {
    if (!handlers.has(event)) {
      handlers.set(event, new Set());
    }
    handlers.get(event)!.add(handler);
  }

  function off(event: string, handler: EventHandler) {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        handlers.delete(event);
      }
    }
  }

  /**
   * Register a callback that fires every time the socket (re)connects.
   * Useful for re-joining rooms after a reconnection.
   */
  function onConnect(cb: ConnectCallback) {
    connectCallbacks.add(cb);
  }

  function offConnect(cb: ConnectCallback) {
    connectCallbacks.delete(cb);
  }

  function disconnect() {
    shouldReconnect = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    connected.value = false;
    handlers.clear();
    connectCallbacks.clear();
    pendingMessages = [];
  }

  // Auto-connect
  connect();

  onUnmounted(() => {
    disconnect();
  });

  return {
    connected,
    send,
    on,
    off,
    onConnect,
    offConnect,
    disconnect,
  };
}
