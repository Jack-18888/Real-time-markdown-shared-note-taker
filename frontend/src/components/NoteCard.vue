<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { NoteListItem } from '@/api/notes';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  note: NoteListItem;
}>();

const emit = defineEmits<{
  delete: [noteId: string];
}>();

const router = useRouter();
const authStore = useAuthStore();

const isOwner = computed(() => props.note.ownerId === authStore.user?.id);

const formattedDate = computed(() => {
  const date = new Date(props.note.updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
});

const permissionLabel = computed(() => {
  switch (props.note.permission) {
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

function openNote() {
  router.push(`/notes/${props.note.id}`);
}

function handleDelete(e: Event) {
  e.stopPropagation();
  if (confirm(`Delete note "${props.note.title}"?`)) {
    emit('delete', props.note.id);
  }
}
</script>

<template>
  <div class="note-card" @click="openNote" tabindex="0" @keyup.enter="openNote">
    <div class="note-card-body">
      <h4 class="note-title">{{ note.title || 'Untitled' }}</h4>
      <div class="note-meta">
        <span class="note-date">{{ formattedDate }}</span>
        <span
          class="note-permission"
          :class="{
            'note-permission--owner': note.permission === 'owner',
            'note-permission--write': note.permission === 'write',
            'note-permission--read': note.permission === 'read',
          }"
        >
          {{ permissionLabel }}
        </span>
      </div>
    </div>
    <button
      v-if="isOwner"
      class="note-delete"
      title="Delete note"
      @click="handleDelete"
    >
      &#10005;
    </button>
  </div>
</template>

<style scoped>
.note-card {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
}

.note-card:hover {
  border-color: #ccc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.note-card:focus {
  outline: 2px solid #4a90d9;
  outline-offset: 1px;
}

.note-card-body {
  flex: 1;
  min-width: 0;
}

.note-title {
  margin: 0 0 0.25rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.note-date {
  color: #888;
}

.note-permission {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
}

.note-permission--owner {
  background: #e8f5e9;
  color: #388e3c;
}

.note-permission--write {
  background: #e8f4fd;
  color: #4a90d9;
}

.note-permission--read {
  background: #f5f5f5;
  color: #888;
}

.note-delete {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: #bbb;
  padding: 0.25rem;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.note-delete:hover {
  color: #d9534f;
  background: #fce4e4;
}
</style>
