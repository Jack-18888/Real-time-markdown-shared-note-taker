<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore } from '@/stores/notes';
import { useAuthStore } from '@/stores/auth';
import { useNoteCollaboration } from '@/composables/useNoteCollaboration';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import MarkdownPreview from '@/components/MarkdownPreview.vue';
import ShareModal from '@/components/ShareModal.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const authStore = useAuthStore();

const noteId = computed(() => route.params.id as string);
const noteIdRef = ref(noteId.value);
const editingTitle = ref(false);
const titleInput = ref('');
const localContent = ref('');
const shareModalVisible = ref(false);

// Track whether the latest local content change came from the user or from WS
let contentFromWs = false;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Set up real-time collaboration
const {
  collaborators,
  error: wsError,
  isConnected,
  sendUpdate,
} = useNoteCollaboration(noteIdRef);

const isOwner = computed(
  () => notesStore.currentNote?.ownerId === authStore.user?.id
);

const permission = computed(
  () => notesStore.currentNote?.permission ?? 'read'
);
const isReadonly = computed(
  () => permission.value === 'read'
);

const permissionLabel = computed(() => {
  switch (permission.value) {
    case 'owner':
      return 'Owner';
    case 'write':
      return 'Can edit';
    case 'read':
      return 'Read only';
    default:
      return '';
  }
});

const connectionLabel = computed(() => {
  return isConnected.value ? 'Live' : 'Offline';
});

onMounted(async () => {
  await notesStore.loadNote(noteId.value);
  if (notesStore.currentNote) {
    localContent.value = notesStore.currentNote.content;
  }
});

onUnmounted(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    // Flush pending save
    if (notesStore.currentNote && localContent.value !== notesStore.currentNote.content) {
      notesStore.editNote(noteId.value, { content: localContent.value });
    }
  }
  notesStore.currentNote = null;
});

// Watch for route changes (navigating between notes)
watch(noteId, async (newId) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  noteIdRef.value = newId;
  await notesStore.loadNote(newId);
  if (notesStore.currentNote) {
    localContent.value = notesStore.currentNote.content;
  }
});

// Watch for remote content updates via WebSocket (note:updated and note:joined)
// The collaboration composable updates notesStore.currentNote.content via updateCurrentNoteContent
watch(
  () => notesStore.currentNote?.content,
  (newContent) => {
    if (newContent !== undefined && newContent !== localContent.value) {
      contentFromWs = true;
      localContent.value = newContent;
    }
  }
);

function onContentChange(value: string) {
  localContent.value = value;

  // If this content change came from a WS update, don't re-send or re-save
  if (contentFromWs) {
    contentFromWs = false;
    return;
  }

  // Send via WebSocket for real-time collaboration (debounced inside composable)
  if (!isReadonly.value) {
    sendUpdate(value);
  }

  // Save via REST API (debounced 500ms)
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    notesStore.editNote(noteId.value, { content: value });
    saveTimeout = null;
  }, 500);
}

function startEditTitle() {
  if (isReadonly.value) return;
  editingTitle.value = true;
  titleInput.value = notesStore.currentNote?.title ?? '';
}

async function submitTitle() {
  editingTitle.value = false;
  const trimmed = titleInput.value.trim();
  if (trimmed && trimmed !== notesStore.currentNote?.title) {
    await notesStore.editNote(noteId.value, { title: trimmed });
  }
}

function cancelTitleEdit() {
  editingTitle.value = false;
}

function goBack() {
  router.push('/');
}
</script>

<template>
  <div class="note-view">
    <header class="note-header">
      <button class="btn-back" @click="goBack">&larr; Back</button>

      <div class="note-title-area">
        <template v-if="editingTitle">
          <input
            v-model="titleInput"
            type="text"
            class="title-input"
            @keyup.enter="submitTitle"
            @keyup.escape="cancelTitleEdit"
            @blur="submitTitle"
            autofocus
          />
        </template>
        <template v-else>
          <h1
            class="note-title"
            :class="{ 'note-title--editable': !isReadonly }"
            @click="startEditTitle"
          >
            {{ notesStore.currentNote?.title || 'Untitled' }}
          </h1>
        </template>
      </div>

      <div class="note-header-meta">
        <span
          class="connection-indicator"
          :class="{
            'connection-indicator--live': isConnected,
            'connection-indicator--offline': !isConnected,
          }"
        >
          {{ connectionLabel }}
        </span>

        <span
          v-if="collaborators.length > 0"
          class="collaborator-count"
          :title="collaborators.join(', ')"
        >
          {{ collaborators.length }} collaborator{{ collaborators.length === 1 ? '' : 's' }}
        </span>

        <button
          v-if="isOwner"
          class="btn-share"
          @click="shareModalVisible = true"
        >
          Share
        </button>
        <span
          class="permission-badge"
          :class="{
            'permission-badge--owner': permission === 'owner',
            'permission-badge--write': permission === 'write',
            'permission-badge--read': permission === 'read',
          }"
        >
          {{ permissionLabel }}
        </span>
      </div>
    </header>

    <div v-if="wsError" class="ws-error-banner">
      WebSocket: {{ wsError.message }}
    </div>

    <div v-if="notesStore.loading" class="loading">Loading note...</div>

    <div v-else-if="notesStore.error" class="error-state">
      <p>{{ notesStore.error }}</p>
      <button class="btn-secondary" @click="goBack">Go back to Dashboard</button>
    </div>

    <div v-else-if="notesStore.currentNote" class="editor-layout">
      <div class="editor-pane">
        <div class="pane-label">Editor</div>
        <MarkdownEditor
          :model-value="localContent"
          :readonly="isReadonly"
          @update:model-value="onContentChange"
        />
      </div>
      <div class="preview-pane">
        <div class="pane-label">Preview</div>
        <MarkdownPreview :content="localContent" />
      </div>
    </div>

    <div v-if="isReadonly && notesStore.currentNote" class="readonly-banner">
      This note is read-only. You cannot edit it.
    </div>

    <ShareModal
      v-if="notesStore.currentNote"
      resource-type="note"
      :resource-id="noteId"
      :visible="shareModalVisible"
      @close="shareModalVisible = false"
    />
  </div>
</template>

<style scoped>
.note-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.note-header {
  display: flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
  gap: 1rem;
  flex-shrink: 0;
}

.btn-back {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 0.3rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: #555;
  transition: background 0.15s;
  flex-shrink: 0;
}

.btn-back:hover {
  background: #f5f5f5;
}

.note-title-area {
  flex: 1;
  min-width: 0;
}

.note-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-title--editable {
  cursor: pointer;
}

.note-title--editable:hover {
  color: #4a90d9;
}

.title-input {
  width: 100%;
  padding: 0.25rem 0.5rem;
  border: 1px solid #4a90d9;
  border-radius: 4px;
  font-size: 1.15rem;
  font-weight: 600;
  outline: none;
}

.note-header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.connection-indicator {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.connection-indicator--live {
  background: #e8f5e9;
  color: #388e3c;
}

.connection-indicator--offline {
  background: #ffebee;
  color: #c62828;
}

.collaborator-count {
  font-size: 0.7rem;
  color: #666;
  padding: 0.15rem 0.4rem;
  background: #f0f0f0;
  border-radius: 3px;
}

.btn-share {
  padding: 0.25rem 0.6rem;
  background: #fff;
  color: #4a90d9;
  border: 1px solid #4a90d9;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-share:hover {
  background: #e8f4fd;
}

.permission-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
}

.permission-badge--owner {
  background: #e8f5e9;
  color: #388e3c;
}

.permission-badge--write {
  background: #e8f4fd;
  color: #4a90d9;
}

.permission-badge--read {
  background: #f5f5f5;
  color: #888;
}

.ws-error-banner {
  padding: 0.4rem 1rem;
  background: #ffebee;
  color: #c62828;
  text-align: center;
  font-size: 0.8rem;
  border-bottom: 1px solid #ffcdd2;
  flex-shrink: 0;
}

.editor-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-pane {
  border-right: 1px solid #e5e5e5;
}

.pane-label {
  padding: 0.375rem 1rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  background: #fafafa;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
}

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #d9534f;
}

.btn-secondary {
  padding: 0.375rem 0.75rem;
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.readonly-banner {
  padding: 0.5rem 1rem;
  background: #fff3cd;
  color: #856404;
  text-align: center;
  font-size: 0.8rem;
  border-top: 1px solid #ffeeba;
  flex-shrink: 0;
}
</style>
