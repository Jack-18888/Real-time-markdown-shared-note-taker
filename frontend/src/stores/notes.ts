import { ref } from 'vue';
import { defineStore } from 'pinia';
import {
  fetchNotes,
  createNote,
  fetchNote,
  updateNote,
  deleteNote,
} from '@/api/notes';
import type { NoteListItem, Note } from '@/api/notes';
import { extractErrorMessage, extractErrorStatus } from '@/api/client';
import { useWebSocket } from '@/composables/useWebSocket';

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<NoteListItem[]>([]);
  const currentNote = ref<Note | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const errorStatus = ref<number | null>(null);

  const ws = useWebSocket();

  ws.on('note:created', (payload) => {
    const data = payload as { note: NoteListItem };
    if (data?.note && !notes.value.some((n) => n.id === data.note.id)) {
      notes.value.push({
        ...data.note,
        permission: data.note.permission || 'write',
      });
    }
  });

  ws.on('note:updated_meta', (payload) => {
    const data = payload as { note: NoteListItem };
    if (data?.note) {
      const idx = notes.value.findIndex((n) => n.id === data.note.id);
      if (idx !== -1) {
        notes.value[idx] = {
          ...notes.value[idx],
          title: data.note.title,
          folderId: data.note.folderId,
          updatedAt: data.note.updatedAt,
        };
      }
      if (currentNote.value?.id === data.note.id) {
        currentNote.value = {
          ...currentNote.value,
          title: data.note.title,
          folderId: data.note.folderId,
          updatedAt: data.note.updatedAt,
        };
      }
    }
  });

  ws.on('note:deleted', (payload) => {
    const data = payload as { noteId: string };
    if (data?.noteId) {
      notes.value = notes.value.filter((n) => n.id !== data.noteId);
      if (currentNote.value?.id === data.noteId) {
        currentNote.value = null;
      }
    }
  });

  ws.on('note:shared', (payload) => {
    const data = payload as { noteId: string };
    if (data?.noteId) {
      loadNotes();
    }
  });

  ws.on('note:unshared', (payload) => {
    const data = payload as { noteId: string };
    if (data?.noteId) {
      notes.value = notes.value.filter((n) => n.id !== data.noteId);
      if (currentNote.value?.id === data.noteId) {
        currentNote.value = null;
      }
    }
  });

  async function loadNotes(folderId?: string) {
    loading.value = true;
    error.value = null;
    errorStatus.value = null;
    try {
      notes.value = await fetchNotes(folderId);
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to load notes');
      errorStatus.value = extractErrorStatus(err);
    } finally {
      loading.value = false;
    }
  }

  async function loadNote(id: string) {
    loading.value = true;
    error.value = null;
    errorStatus.value = null;
    try {
      currentNote.value = await fetchNote(id);
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to load note');
      errorStatus.value = extractErrorStatus(err);
    } finally {
      loading.value = false;
    }
  }

  async function addNote(
    title: string,
    content: string,
    folderId?: string | null
  ) {
    loading.value = true;
    error.value = null;
    errorStatus.value = null;
    try {
      const note = await createNote(title, content, folderId);
      notes.value.push({
        id: note.id,
        title: note.title,
        folderId: note.folderId,
        ownerId: note.ownerId,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        permission: 'owner',
      });
      return note;
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to create note');
      errorStatus.value = extractErrorStatus(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function editNote(
    id: string,
    data: { title?: string; content?: string; folderId?: string | null }
  ) {
    error.value = null;
    errorStatus.value = null;
    try {
      const updated = await updateNote(id, data);

      const index = notes.value.findIndex((n) => n.id === id);
      if (index !== -1) {
        notes.value[index] = {
          ...notes.value[index],
          title: updated.title,
          folderId: updated.folderId,
          updatedAt: updated.updatedAt,
        };
      }

      if (currentNote.value?.id === id) {
        currentNote.value = {
          ...updated,
          permission: currentNote.value.permission,
        };
      }

      return updated;
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to update note');
      errorStatus.value = extractErrorStatus(err);
      throw err;
    }
  }

  async function removeNote(id: string) {
    loading.value = true;
    error.value = null;
    errorStatus.value = null;
    try {
      await deleteNote(id);
      notes.value = notes.value.filter((n) => n.id !== id);
      if (currentNote.value?.id === id) {
        currentNote.value = null;
      }
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to delete note');
      errorStatus.value = extractErrorStatus(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function updateCurrentNoteContent(content: string) {
    if (currentNote.value) {
      currentNote.value = { ...currentNote.value, content };
    }
  }

  return {
    notes,
    currentNote,
    loading,
    error,
    errorStatus,
    loadNotes,
    loadNote,
    addNote,
    editNote,
    removeNote,
    updateCurrentNoteContent,
  };
});
