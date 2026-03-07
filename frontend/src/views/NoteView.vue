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

    <div v-if="notesStore.loading" class="loading">
      <span class="spinner"></span>
      <span>Loading note...</span>
    </div>

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
  background: var(--color-bg);
}

.note-header {
  display: flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  gap: var(--space-lg);
  flex-shrink: 0;
}

.btn-back {
  background: none;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  padding: 0.3rem var(--space-md);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.btn-back:hover {
  background: var(--color-bg);
}

.note-title-area {
  flex: 1;
  min-width: 0;
}

.note-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text-heading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-title--editable {
  cursor: pointer;
}

.note-title--editable:hover {
  color: var(--color-primary);
}

.title-input {
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-size: 1.15rem;
  font-weight: 600;
  outline: none;
}

.note-header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.connection-indicator {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.connection-indicator--live {
  background: var(--color-success-light);
  color: var(--color-success);
}

.connection-indicator--offline {
  background: #ffebee;
  color: #c62828;
}

.collaborator-count {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  padding: 0.15rem 0.4rem;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
}

.btn-share {
  padding: var(--space-xs) 0.6rem;
  background: var(--color-bg-white);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-share:hover {
  background: var(--color-primary-light);
}

.permission-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.2rem var(--space-sm);
  border-radius: var(--radius-sm);
}

.permission-badge--owner {
  background: var(--color-success-light);
  color: var(--color-success);
}

.permission-badge--write {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.permission-badge--read {
  background: var(--color-bg);
  color: var(--color-text-muted);
}

.ws-error-banner {
  padding: 0.4rem var(--space-lg);
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
  min-height: 0;
}

.editor-pane {
  border-right: 1px solid var(--color-border);
}

.pane-label {
  padding: 0.375rem var(--space-lg);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
}

.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  color: var(--color-danger);
}

.btn-secondary {
  padding: 0.375rem var(--space-md);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-bg);
}

.readonly-banner {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
  text-align: center;
  font-size: 0.8rem;
  border-top: 1px solid var(--color-warning-border);
  flex-shrink: 0;
}

/* Responsive: stack editor and preview on small screens */
@media (max-width: 768px) {
  .note-header {
    padding: var(--space-sm) var(--space-md);
    gap: var(--space-sm);
  }

  .note-title {
    font-size: 1rem;
  }

  .editor-layout {
    flex-direction: column;
  }

  .editor-pane {
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    flex: 1;
  }

  .preview-pane {
    flex: 1;
  }

  .collaborator-count {
    display: none;
  }
}
</style>
