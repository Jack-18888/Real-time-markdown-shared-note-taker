import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import {
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from '@/api/folders';
import type { Folder } from '@/api/folders';
import { extractErrorMessage } from '@/api/client';

export const useFoldersStore = defineStore('folders', () => {
  const folders = ref<Folder[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const rootFolders = computed(() =>
    folders.value.filter((f) => f.parentId === null)
  );

  function getChildFolders(parentId: string): Folder[] {
    return folders.value.filter((f) => f.parentId === parentId);
  }

  async function loadFolders() {
    loading.value = true;
    error.value = null;
    try {
      folders.value = await fetchFolders();
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to load folders');
    } finally {
      loading.value = false;
    }
  }

  async function addFolder(name: string, parentId?: string | null) {
    loading.value = true;
    error.value = null;
    try {
      const folder = await createFolder(name, parentId);
      folders.value.push({ ...folder, permission: 'owner' });
      return folder;
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to create folder');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function editFolder(
    id: string,
    data: { name?: string; parentId?: string | null }
  ) {
    loading.value = true;
    error.value = null;
    try {
      const updated = await updateFolder(id, data);
      const index = folders.value.findIndex((f) => f.id === id);
      if (index !== -1) {
        folders.value[index] = {
          ...updated,
          permission: folders.value[index].permission,
        };
      }
      return updated;
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to update folder');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function removeFolder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await deleteFolder(id);
      // Remove the folder and all its descendants
      const idsToRemove = new Set<string>();
      idsToRemove.add(id);

      let changed = true;
      while (changed) {
        changed = false;
        for (const f of folders.value) {
          if (f.parentId && idsToRemove.has(f.parentId) && !idsToRemove.has(f.id)) {
            idsToRemove.add(f.id);
            changed = true;
          }
        }
      }

      folders.value = folders.value.filter((f) => !idsToRemove.has(f.id));
    } catch (err: unknown) {
      error.value = extractErrorMessage(err, 'Failed to delete folder');
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    folders,
    loading,
    error,
    rootFolders,
    getChildFolders,
    loadFolders,
    addFolder,
    editFolder,
    removeFolder,
  };
});
