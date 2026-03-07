<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useFoldersStore } from '@/stores/folders';
import { useNotesStore } from '@/stores/notes';
import FolderTree from '@/components/FolderTree.vue';
import NoteCard from '@/components/NoteCard.vue';
import ShareModal from '@/components/ShareModal.vue';

const router = useRouter();
const authStore = useAuthStore();
const foldersStore = useFoldersStore();
const notesStore = useNotesStore();

const selectedFolderId = ref<string | null>(null);
const shareModalVisible = ref(false);
const shareResourceType = ref<'note' | 'folder'>('note');
const shareResourceId = ref('');

onMounted(async () => {
  await Promise.all([foldersStore.loadFolders(), notesStore.loadNotes()]);
});

function onFolderSelect(folderId: string | null) {
  selectedFolderId.value = folderId;
  notesStore.loadNotes(folderId ?? undefined);
}

async function createNote() {
  try {
    const note = await notesStore.addNote(
      'Untitled Note',
      '',
      selectedFolderId.value
    );
    if (note) {
      router.push(`/notes/${note.id}`);
    }
  } catch {
    // error is set in the store
  }
}

async function handleDeleteNote(noteId: string) {
  try {
    await notesStore.removeNote(noteId);
  } catch {
    // error is set in the store
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

function openShareModal(type: 'note' | 'folder', id: string) {
  shareResourceType.value = type;
  shareResourceId.value = id;
  shareModalVisible.value = true;
}

function closeShareModal() {
  shareModalVisible.value = false;
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>Notes</h1>
      <div class="header-right">
        <span class="user-email">{{ authStore.user?.email }}</span>
        <button class="btn-secondary" @click="handleLogout">Logout</button>
      </div>
    </header>

    <div class="dashboard-body">
      <aside class="sidebar">
        <FolderTree
          @select="onFolderSelect"
          @share="(folderId: string) => openShareModal('folder', folderId)"
        />
      </aside>

      <main class="content">
        <div class="content-header">
          <h2>
            {{ selectedFolderId ? 'Folder Notes' : 'All Notes' }}
          </h2>
          <button class="btn-primary" @click="createNote">+ New Note</button>
        </div>

        <div v-if="notesStore.loading || foldersStore.loading" class="loading">
          Loading...
        </div>

        <div v-if="notesStore.error" class="error-banner">
          {{ notesStore.error }}
        </div>

        <div v-if="!notesStore.loading && notesStore.notes.length === 0 && !notesStore.error" class="empty-state">
          <p>No notes yet. Click <strong>+ New Note</strong> to create one.</p>
        </div>

        <div class="notes-list">
          <NoteCard
            v-for="note in notesStore.notes"
            :key="note.id"
            :note="note"
            @delete="handleDeleteNote"
            @share="(noteId: string) => openShareModal('note', noteId)"
          />
        </div>
      </main>
    </div>

    <ShareModal
      :resource-type="shareResourceType"
      :resource-id="shareResourceId"
      :visible="shareModalVisible"
      @close="closeShareModal"
    />
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
  flex-shrink: 0;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: #333;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-email {
  font-size: 0.85rem;
  color: #666;
}

.dashboard-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background: #fff;
  border-right: 1px solid #e5e5e5;
  overflow-y: auto;
  flex-shrink: 0;
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.content-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.loading {
  text-align: center;
  color: #888;
  padding: 2rem;
}

.error-banner {
  padding: 0.75rem 1rem;
  background: #fdf2f2;
  color: #d9534f;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  color: #888;
  padding: 3rem 1rem;
  font-size: 0.95rem;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary:hover {
  background: #357abd;
}

.btn-secondary {
  padding: 0.375rem 0.75rem;
  background: #fff;
  color: #555;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover {
  background: #f5f5f5;
}
</style>
