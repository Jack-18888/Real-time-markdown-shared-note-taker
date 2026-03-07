<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore } from '@/stores/notes';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import MarkdownPreview from '@/components/MarkdownPreview.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();

const noteId = computed(() => route.params.id as string);
const editingTitle = ref(false);
const titleInput = ref('');
const localContent = ref('');

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

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
  }
  await notesStore.loadNote(newId);
  if (notesStore.currentNote) {
    localContent.value = notesStore.currentNote.content;
  }
});

function onContentChange(value: string) {
  localContent.value = value;

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
