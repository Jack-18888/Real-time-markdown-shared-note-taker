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
const sidebarOpen = ref(false);
const creatingNote = ref(false);
const deletingNoteId = ref<string | null>(null);

onMounted(async () => {
  await Promise.all([foldersStore.loadFolders(), notesStore.loadNotes()]);
});

function onFolderSelect(folderId: string | null) {
  selectedFolderId.value = folderId;
  notesStore.loadNotes(folderId ?? undefined);
  sidebarOpen.value = false;
}

async function createNote() {
  if (creatingNote.value) return;
  creatingNote.value = true;
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
  } finally {
    creatingNote.value = false;
  }
}

async function handleDeleteNote(noteId: string) {
  if (deletingNoteId.value) return;
  deletingNoteId.value = noteId;
  try {
    await notesStore.removeNote(noteId);
  } catch {
    // error is set in the store
  } finally {
    deletingNoteId.value = null;
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

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
</script>

<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <div class="header-left">
        <button class="btn-menu" @click="toggleSidebar" aria-label="Toggle sidebar">
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
          <span class="menu-bar"></span>
        </button>
        <h1>Notes</h1>
      </div>
      <div class="header-right">
        <span class="user-email">{{ authStore.user?.email }}</span>
        <button class="btn-secondary" @click="handleLogout">Logout</button>
      </div>
    </header>

    <div class="dashboard-body">
      <!-- Overlay for mobile sidebar -->
      <div
        v-if="sidebarOpen"
        class="sidebar-overlay"
        @click="sidebarOpen = false"
      ></div>

      <aside class="sidebar" :class="{ 'sidebar--open': sidebarOpen }">
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
          <button class="btn-primary" :disabled="creatingNote" @click="createNote">
            {{ creatingNote ? 'Creating...' : '+ New Note' }}
          </button>
        </div>

        <div v-if="notesStore.loading || foldersStore.loading" class="loading">
          <span class="spinner"></span>
          <span>Loading...</span>
        </div>

        <div v-if="notesStore.error" class="error-banner">
          {{ notesStore.error }}
        </div>

        <div v-if="foldersStore.error" class="error-banner">
          {{ foldersStore.error }}
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
  background: var(--color-bg);
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-xl);
  background: var(--color-bg-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--color-text-heading);
}

.btn-menu {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-xs);
}

.menu-bar {
  display: block;
  width: 18px;
  height: 2px;
  background: var(--color-text-secondary);
  border-radius: 1px;
  transition: var(--transition-fast);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.user-email {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dashboard-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.sidebar-overlay {
  display: none;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-white);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  flex-shrink: 0;
  transition: transform var(--transition-normal);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl);
}

.content-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.content-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-heading);
}

.notes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--color-text-muted);
  padding: var(--space-2xl);
}

.error-banner {
  padding: var(--space-md) var(--space-lg);
  background: var(--color-danger-bg);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-lg);
  font-size: 0.875rem;
}

.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: 3rem var(--space-lg);
  font-size: 0.95rem;
}

.btn-primary {
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 0.375rem var(--space-md);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  font-size: 0.8rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-bg);
}

/* Responsive: mobile sidebar */
@media (max-width: 768px) {
  .btn-menu {
    display: flex;
  }

  .sidebar-overlay {
    display: block;
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 20;
    transform: translateX(-100%);
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.1);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .content {
    padding: var(--space-lg);
  }

  .user-email {
    display: none;
  }
}
</style>
