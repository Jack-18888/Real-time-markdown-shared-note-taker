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

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<NoteListItem[]>([]);
  const currentNote = ref<Note | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadNotes(folderId?: string) {
    loading.value = true;
    error.value = null;
    try {
      notes.value = await fetchNotes(folderId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load notes';
      error.value = message;
    } finally {
      loading.value = false;
    }
  }

  async function loadNote(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentNote.value = await fetchNote(id);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load note';
      error.value = message;
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
      const message =
        err instanceof Error ? err.message : 'Failed to create note';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function editNote(
    id: string,
    data: { title?: string; content?: string; folderId?: string | null }
  ) {
    loading.value = true;
    error.value = null;
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
      const message =
        err instanceof Error ? err.message : 'Failed to update note';
      error.value = message;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeNote(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await deleteNote(id);
      notes.value = notes.value.filter((n) => n.id !== id);
      if (currentNote.value?.id === id) {
        currentNote.value = null;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete note';
      error.value = message;
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
    loadNotes,
    loadNote,
    addNote,
    editNote,
    removeNote,
    updateCurrentNoteContent,
  };
});
