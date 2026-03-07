<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  fetchNoteShares,
  createNoteShare,
  updateNoteShare,
  deleteNoteShare,
} from '@/api/notes';
import {
  fetchFolderShares,
  createFolderShare,
  updateFolderShare,
  deleteFolderShare,
} from '@/api/folders';
import type { NoteShare } from '@/api/notes';
import type { FolderShare } from '@/api/folders';

type Share = NoteShare | FolderShare;

const props = defineProps<{
  resourceType: 'note' | 'folder';
  resourceId: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const shares = ref<Share[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const newEmail = ref('');
const newPermission = ref<'read' | 'write'>('read');
const addingShare = ref(false);
const addError = ref<string | null>(null);

watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      await loadShares();
    } else {
      shares.value = [];
      error.value = null;
      addError.value = null;
      newEmail.value = '';
      newPermission.value = 'read';
    }
  }
);

async function loadShares() {
  loading.value = true;
  error.value = null;
  try {
    if (props.resourceType === 'note') {
      shares.value = await fetchNoteShares(props.resourceId);
    } else {
      shares.value = await fetchFolderShares(props.resourceId);
    }
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      error.value = axiosErr.response?.data?.error || 'Failed to load shares';
    } else {
      error.value = 'Failed to load shares';
    }
  } finally {
    loading.value = false;
  }
}

async function addShare() {
  const email = newEmail.value.trim();
  if (!email) return;

  addingShare.value = true;
  addError.value = null;
  try {
    if (props.resourceType === 'note') {
      await createNoteShare(props.resourceId, email, newPermission.value);
    } else {
      await createFolderShare(props.resourceId, email, newPermission.value);
    }
    newEmail.value = '';
    newPermission.value = 'read';
    await loadShares();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      addError.value = axiosErr.response?.data?.error || 'Failed to add share';
    } else {
      addError.value = 'Failed to add share';
    }
  } finally {
    addingShare.value = false;
  }
}

async function changePermission(userId: string, permission: 'read' | 'write') {
  try {
    if (props.resourceType === 'note') {
      await updateNoteShare(props.resourceId, userId, permission);
    } else {
      await updateFolderShare(props.resourceId, userId, permission);
    }
    await loadShares();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      error.value = axiosErr.response?.data?.error || 'Failed to update share';
    } else {
      error.value = 'Failed to update share';
    }
  }
}

async function removeShare(userId: string) {
  try {
    if (props.resourceType === 'note') {
      await deleteNoteShare(props.resourceId, userId);
    } else {
      await deleteFolderShare(props.resourceId, userId);
    }
    await loadShares();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'response' in err) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      error.value = axiosErr.response?.data?.error || 'Failed to remove share';
    } else {
      error.value = 'Failed to remove share';
    }
  }
}

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
    emit('close');
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="modal-overlay"
      @click="handleOverlayClick"
      @keyup.escape="handleEscape"
      tabindex="-1"
    >
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>Share {{ resourceType === 'note' ? 'Note' : 'Folder' }}</h2>
          <button class="btn-close" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <!-- Add share form -->
          <div class="add-share-form">
            <input
              v-model="newEmail"
              type="email"
              placeholder="User email"
              class="share-email-input"
              @keyup.enter="addShare"
            />
            <select v-model="newPermission" class="share-permission-select">
              <option value="read">Read</option>
              <option value="write">Write</option>
            </select>
            <button
              class="btn-primary"
              :disabled="addingShare || !newEmail.trim()"
              @click="addShare"
            >
              {{ addingShare ? 'Adding...' : 'Add' }}
            </button>
          </div>
          <div v-if="addError" class="error-message">{{ addError }}</div>

          <!-- Error banner -->
          <div v-if="error" class="error-message">{{ error }}</div>

          <!-- Loading -->
          <div v-if="loading" class="loading">Loading shares...</div>

          <!-- Shares list -->
          <div v-else class="shares-list">
            <div v-if="shares.length === 0" class="empty-shares">
              Not shared with anyone yet.
            </div>
            <div v-for="share in shares" :key="share.userId" class="share-row">
              <span class="share-email">{{ share.email }}</span>
              <select
                :value="share.permission"
                class="share-permission-select"
                @change="changePermission(share.userId, ($event.target as HTMLSelectElement).value as 'read' | 'write')"
              >
                <option value="read">Read</option>
                <option value="write">Write</option>
              </select>
              <button
                class="btn-icon btn-icon--danger"
                title="Remove access"
                @click="removeShare(share.userId)"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e5e5;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #888;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #333;
}

.modal-body {
  padding: 1.25rem;
  overflow-y: auto;
}

.add-share-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.share-email-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
}

.share-email-input:focus {
  outline: none;
  border-color: #4a90d9;
}

.share-permission-select {
  padding: 0.4rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.8rem;
  background: #fff;
  cursor: pointer;
}

.btn-primary {
  padding: 0.4rem 0.75rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: #357abd;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #d9534f;
  font-size: 0.8rem;
  margin-bottom: 0.75rem;
  padding: 0.4rem 0.6rem;
  background: #fdf2f2;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
}

.loading {
  text-align: center;
  color: #888;
  padding: 1rem;
  font-size: 0.875rem;
}

.shares-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-shares {
  text-align: center;
  color: #888;
  padding: 1rem;
  font-size: 0.875rem;
}

.share-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.share-email {
  flex: 1;
  font-size: 0.875rem;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: #bbb;
  padding: 0.2rem;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
}

.btn-icon--danger:hover {
  color: #d9534f;
  background: #fce4e4;
}
</style>
