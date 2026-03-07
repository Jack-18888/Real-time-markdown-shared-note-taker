<script setup lang="ts">
import { ref, computed } from 'vue';
import { useFoldersStore } from '@/stores/folders';
import { useAuthStore } from '@/stores/auth';
import type { Folder } from '@/api/folders';

const emit = defineEmits<{
  select: [folderId: string | null];
  share: [folderId: string];
}>();

const foldersStore = useFoldersStore();
const authStore = useAuthStore();

const expanded = ref<Set<string>>(new Set());
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const newFolderParentId = ref<string | null | undefined>(undefined);
const newFolderName = ref('');

const isOwner = (folder: Folder) => folder.ownerId === authStore.user?.id;

const rootFolders = computed(() => foldersStore.rootFolders);

function toggleExpand(folderId: string) {
  if (expanded.value.has(folderId)) {
    expanded.value.delete(folderId);
  } else {
    expanded.value.add(folderId);
  }
}

function selectFolder(folderId: string | null) {
  emit('select', folderId);
}

function startRename(folder: Folder) {
  renamingId.value = folder.id;
  renameValue.value = folder.name;
}

async function submitRename(folderId: string) {
  if (renameValue.value.trim()) {
    await foldersStore.editFolder(folderId, { name: renameValue.value.trim() });
  }
  renamingId.value = null;
  renameValue.value = '';
}

function cancelRename() {
  renamingId.value = null;
  renameValue.value = '';
}

function showNewFolderInput(parentId: string | null) {
  newFolderParentId.value = parentId;
  newFolderName.value = '';
  if (parentId) {
    expanded.value.add(parentId);
  }
}

async function createNewFolder() {
  const name = newFolderName.value.trim();
  if (!name) {
    newFolderParentId.value = undefined;
    return;
  }
  await foldersStore.addFolder(name, newFolderParentId.value);
  newFolderParentId.value = undefined;
  newFolderName.value = '';
}

function cancelNewFolder() {
  newFolderParentId.value = undefined;
  newFolderName.value = '';
}

async function handleDelete(folder: Folder) {
  if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
    await foldersStore.removeFolder(folder.id);
  }
}

function getChildren(parentId: string): Folder[] {
  return foldersStore.getChildFolders(parentId);
}
</script>

<template>
  <nav class="folder-tree">
    <div class="folder-tree-header">
      <h3>Folders</h3>
      <button
        class="btn-icon"
        title="New root folder"
        @click="showNewFolderInput(null)"
      >
        +
      </button>
    </div>

    <ul class="folder-list">
      <li
        class="folder-item folder-item--root"
        @click="selectFolder(null)"
      >
        <span class="folder-label">All Notes</span>
      </li>

      <!-- New root folder input -->
      <li v-if="newFolderParentId === null" class="folder-item folder-item--new">
        <input
          v-model="newFolderName"
          type="text"
          placeholder="Folder name"
          class="rename-input"
          @keyup.enter="createNewFolder"
          @keyup.escape="cancelNewFolder"
          @blur="createNewFolder"
          ref="newFolderInput"
          autofocus
        />
      </li>

      <template v-for="folder in rootFolders" :key="folder.id">
        <li class="folder-item">
          <div class="folder-row">
            <button
              class="btn-expand"
              :class="{ 'btn-expand--expanded': expanded.has(folder.id) }"
              @click.stop="toggleExpand(folder.id)"
            >
              <span v-if="getChildren(folder.id).length > 0">&#9654;</span>
              <span v-else class="expand-spacer">&nbsp;</span>
            </button>

            <template v-if="renamingId === folder.id">
              <input
                v-model="renameValue"
                type="text"
                class="rename-input"
                @keyup.enter="submitRename(folder.id)"
                @keyup.escape="cancelRename"
                @blur="submitRename(folder.id)"
                autofocus
              />
            </template>
            <template v-else>
              <span
                class="folder-label"
                :class="{ 'folder-label--shared': !isOwner(folder) }"
                @click="selectFolder(folder.id)"
              >
                {{ folder.name }}
              </span>
            </template>

            <span v-if="!isOwner(folder)" class="badge badge--shared" title="Shared with you">
              {{ folder.permission }}
            </span>

            <div v-if="isOwner(folder)" class="folder-actions">
              <button class="btn-icon btn-icon--sm" title="New subfolder" @click.stop="showNewFolderInput(folder.id)">+</button>
              <button class="btn-icon btn-icon--sm" title="Rename" @click.stop="startRename(folder)">&#9998;</button>
              <button class="btn-icon btn-icon--sm" title="Share" @click.stop="emit('share', folder.id)">&#128279;</button>
              <button class="btn-icon btn-icon--sm btn-icon--danger" title="Delete" @click.stop="handleDelete(folder)">&#10005;</button>
            </div>
          </div>

          <!-- Children -->
          <ul v-if="expanded.has(folder.id)" class="folder-list folder-list--nested">
            <!-- New subfolder input -->
            <li v-if="newFolderParentId === folder.id" class="folder-item folder-item--new">
              <input
                v-model="newFolderName"
                type="text"
                placeholder="Subfolder name"
                class="rename-input"
                @keyup.enter="createNewFolder"
                @keyup.escape="cancelNewFolder"
                @blur="createNewFolder"
                autofocus
              />
            </li>

            <template v-for="child in getChildren(folder.id)" :key="child.id">
              <li class="folder-item">
                <div class="folder-row">
                  <button
                    class="btn-expand"
                    :class="{ 'btn-expand--expanded': expanded.has(child.id) }"
                    @click.stop="toggleExpand(child.id)"
                  >
                    <span v-if="getChildren(child.id).length > 0">&#9654;</span>
                    <span v-else class="expand-spacer">&nbsp;</span>
                  </button>

                  <template v-if="renamingId === child.id">
                    <input
                      v-model="renameValue"
                      type="text"
                      class="rename-input"
                      @keyup.enter="submitRename(child.id)"
                      @keyup.escape="cancelRename"
                      @blur="submitRename(child.id)"
                      autofocus
                    />
                  </template>
                  <template v-else>
                    <span
                      class="folder-label"
                      :class="{ 'folder-label--shared': !isOwner(child) }"
                      @click="selectFolder(child.id)"
                    >
                      {{ child.name }}
                    </span>
                  </template>

                  <span v-if="!isOwner(child)" class="badge badge--shared" title="Shared with you">
                    {{ child.permission }}
                  </span>

                  <div v-if="isOwner(child)" class="folder-actions">
                    <button class="btn-icon btn-icon--sm" title="New subfolder" @click.stop="showNewFolderInput(child.id)">+</button>
                    <button class="btn-icon btn-icon--sm" title="Rename" @click.stop="startRename(child)">&#9998;</button>
                    <button class="btn-icon btn-icon--sm" title="Share" @click.stop="emit('share', child.id)">&#128279;</button>
                    <button class="btn-icon btn-icon--sm btn-icon--danger" title="Delete" @click.stop="handleDelete(child)">&#10005;</button>
                  </div>
                </div>

                <!-- Grandchildren -->
                <ul v-if="expanded.has(child.id)" class="folder-list folder-list--nested">
                  <li v-if="newFolderParentId === child.id" class="folder-item folder-item--new">
                    <input
                      v-model="newFolderName"
                      type="text"
                      placeholder="Subfolder name"
                      class="rename-input"
                      @keyup.enter="createNewFolder"
                      @keyup.escape="cancelNewFolder"
                      @blur="createNewFolder"
                      autofocus
                    />
                  </li>
                  <li
                    v-for="grandchild in getChildren(child.id)"
                    :key="grandchild.id"
                    class="folder-item"
                  >
                    <div class="folder-row">
                      <span class="expand-spacer">&nbsp;&nbsp;</span>
                      <template v-if="renamingId === grandchild.id">
                        <input
                          v-model="renameValue"
                          type="text"
                          class="rename-input"
                          @keyup.enter="submitRename(grandchild.id)"
                          @keyup.escape="cancelRename"
                          @blur="submitRename(grandchild.id)"
                          autofocus
                        />
                      </template>
                      <template v-else>
                        <span
                          class="folder-label"
                          :class="{ 'folder-label--shared': !isOwner(grandchild) }"
                          @click="selectFolder(grandchild.id)"
                        >
                          {{ grandchild.name }}
                        </span>
                      </template>

                      <span v-if="!isOwner(grandchild)" class="badge badge--shared">
                        {{ grandchild.permission }}
                      </span>

                      <div v-if="isOwner(grandchild)" class="folder-actions">
                        <button class="btn-icon btn-icon--sm" title="Rename" @click.stop="startRename(grandchild)">&#9998;</button>
                        <button class="btn-icon btn-icon--sm" title="Share" @click.stop="emit('share', grandchild.id)">&#128279;</button>
                        <button class="btn-icon btn-icon--sm btn-icon--danger" title="Delete" @click.stop="handleDelete(grandchild)">&#10005;</button>
                      </div>
                    </div>
                  </li>
                </ul>
              </li>
            </template>
          </ul>
        </li>
      </template>
    </ul>
  </nav>
</template>

<style scoped>
.folder-tree {
  padding: 0.5rem 0;
}

.folder-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem 0.5rem;
}

.folder-tree-header h3 {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
}

.folder-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.folder-list--nested {
  padding-left: 1rem;
}

.folder-item {
  margin: 0;
}

.folder-item--root {
  padding: 0.375rem 0.75rem;
  cursor: pointer;
}

.folder-item--root:hover {
  background: #f0f0f0;
}

.folder-row {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  gap: 0.25rem;
}

.folder-row:hover {
  background: #f0f0f0;
}

.btn-expand {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.6rem;
  color: #888;
  width: 1rem;
  text-align: center;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.btn-expand--expanded {
  transform: rotate(90deg);
}

.expand-spacer {
  display: inline-block;
  width: 1rem;
  flex-shrink: 0;
}

.folder-label {
  flex: 1;
  cursor: pointer;
  font-size: 0.875rem;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-label--shared {
  color: #666;
  font-style: italic;
}

.badge {
  font-size: 0.65rem;
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}

.badge--shared {
  background: #e8f4fd;
  color: #4a90d9;
}

.folder-actions {
  display: none;
  gap: 0.125rem;
  flex-shrink: 0;
}

.folder-row:hover .folder-actions {
  display: flex;
}

.btn-icon {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  color: #555;
  font-size: 0.875rem;
  padding: 0.125rem 0.375rem;
  transition: background 0.15s;
}

.btn-icon:hover {
  background: #e8e8e8;
}

.btn-icon--sm {
  font-size: 0.7rem;
  padding: 0.1rem 0.25rem;
}

.btn-icon--danger:hover {
  background: #fce4e4;
  color: #d9534f;
}

.rename-input {
  flex: 1;
  padding: 0.2rem 0.4rem;
  border: 1px solid #4a90d9;
  border-radius: 3px;
  font-size: 0.875rem;
  outline: none;
}

.folder-item--new {
  padding: 0.25rem 0.75rem 0.25rem 2.5rem;
}
</style>
