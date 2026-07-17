import { ref, watch, onUnmounted, type Ref } from 'vue';
import { useWebSocket } from '@/composables/useWebSocket';
import { useNotesStore } from '@/stores/notes';

interface NoteError {
  code: string;
  message: string;
}

interface JoinedPayload {
  noteId: string;
  content: string;
  collaborators: string[];
}

interface UpdatedPayload {
  noteId: string;
  content: string;
  updatedBy: string;
}

interface PresencePayload {
  noteId: string;
  collaborators: string[];
}

interface ErrorPayload {
  code: string;
  message: string;
}

export function useNoteCollaboration(noteId: Ref<string>) {
  const notesStore = useNotesStore();
  const { connected, send, on, off, onConnect, offConnect, disconnect } = useWebSocket();

  const collaborators = ref<string[]>([]);
  const error = ref<NoteError | null>(null);
  const isConnected = connected;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentJoinedNoteId: string | null = null;

  // Track the last content we sent so we can ignore the echo from the store update
  let lastSentContent: string | null = null;

  function joinNote(id: string) {
    if (currentJoinedNoteId && currentJoinedNoteId !== id) {
      send('note:leave', { noteId: currentJoinedNoteId });
    }
    currentJoinedNoteId = id;
    collaborators.value = [];
    error.value = null;
    send('note:join', { noteId: id });
  }

  function leaveNote() {
    if (currentJoinedNoteId) {
      send('note:leave', { noteId: currentJoinedNoteId });
      currentJoinedNoteId = null;
    }
    collaborators.value = [];
  }

  function handleJoined(payload: unknown) {
    const data = payload as JoinedPayload;
    if (data.noteId !== currentJoinedNoteId) return;
    notesStore.updateCurrentNoteContent(data.content);
    collaborators.value = data.collaborators;
  }

  function handleUpdated(payload: unknown) {
    const data = payload as UpdatedPayload;
    if (data.noteId !== currentJoinedNoteId) return;
    notesStore.updateCurrentNoteContent(data.content);
  }

  function handlePresence(payload: unknown) {
    const data = payload as PresencePayload;
    if (data.noteId !== currentJoinedNoteId) return;
    collaborators.value = data.collaborators;
  }

  function handleError(payload: unknown) {
    const data = payload as ErrorPayload;
    error.value = { code: data.code, message: data.message };
  }

  // Register event handlers
  on('note:joined', handleJoined);
  on('note:updated', handleUpdated);
  on('note:presence', handlePresence);
  on('note:error', handleError);

  /**
   * Called every time the WebSocket (re)connects.
   * Re-joins the current note room so the server starts
   * broadcasting updates to this client again.
   */
  function handleConnect() {
    if (currentJoinedNoteId) {
      collaborators.value = [];
      error.value = null;
      send('note:join', { noteId: currentJoinedNoteId });
    }
  }

  onConnect(handleConnect);

  /**
   * Send a content update to collaborators via WebSocket.
   * Debounced at 300ms to avoid flooding.
   */
  function sendUpdate(content: string) {
    if (!currentJoinedNoteId) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      lastSentContent = content;
      send('note:update', { noteId: currentJoinedNoteId, content });
    }, 300);
  }

  // Watch for noteId changes to join/leave rooms
  watch(
    noteId,
    (newId, oldId) => {
      if (oldId && oldId !== newId) {
        send('note:leave', { noteId: oldId });
      }
      if (newId) {
        currentJoinedNoteId = newId;
        collaborators.value = [];
        error.value = null;
        send('note:join', { noteId: newId });
      }
    },
    { immediate: false }
  );

  // Initial join — the message will be queued if the socket isn't open yet
  if (noteId.value) {
    joinNote(noteId.value);
  }

  onUnmounted(() => {
    leaveNote();

    // Clean up event handlers
    off('note:joined', handleJoined);
    off('note:updated', handleUpdated);
    off('note:presence', handlePresence);
    off('note:error', handleError);
    offConnect(handleConnect);

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    disconnect();
  });

  return {
    collaborators,
    error,
    isConnected,
    sendUpdate,
    lastSentContent: () => lastSentContent,
  };
}

