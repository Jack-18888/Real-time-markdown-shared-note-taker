import { ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';

type EventHandler = (payload: unknown) => void;

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000/ws';
const MAX_RECONNECT_DELAY = 30000;

let ws: WebSocket | null = null;
const connected = ref(false);
const handlers = new Map<string, Set<EventHandler>>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let shouldReconnect = true;

export function useWebSocket() {
  const authStore = useAuthStore();

  function connect() {
    const token = authStore.accessToken;
    if (!token) return;

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    shouldReconnect = true;

    try {
      ws = new WebSocket(`${WS_BASE_URL}?token=${token}`);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      connected.value = true;
      reconnectAttempts = 0;
    };

    ws.onclose = () => {
      connected.value = false;
      ws = null;
      if (shouldReconnect && authStore.isAuthenticated) {
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
    if (!shouldReconnect || !authStore.isAuthenticated) return;
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
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event, payload }));
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
  }

  // Auto connect/disconnect based on authentication status
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        connect();
      } else {
        disconnect();
      }
    },
    { immediate: true }
  );

  return {
    connected,
    connect,
    send,
    on,
    off,
    disconnect,
  };
}
