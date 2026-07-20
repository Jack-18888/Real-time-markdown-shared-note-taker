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
import { useWebSocket } from '@/composables/useWebSocket';

export const useFoldersStore = defineStore('folders', () => {
  const folders = ref<Folder[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const ws = useWebSocket();

  ws.on('folder:created', (payload) => {
    const data = payload as { folder: Folder };
    if (data?.folder && !folders.value.some((f) => f.id === data.folder.id)) {
      folders.value.push(data.folder);
    }
  });

  ws.on('folder:updated', (payload) => {
    const data = payload as { folder: Folder };
    if (data?.folder) {
      const idx = folders.value.findIndex((f) => f.id === data.folder.id);
      if (idx !== -1) {
        folders.value[idx] = { ...folders.value[idx], ...data.folder };
      } else {
        folders.value.push(data.folder);
      }
    }
  });

  ws.on('folder:deleted', (payload) => {
    const data = payload as { folderId: string; deletedFolderIds?: string[] };
    if (data) {
      const ids = new Set(data.deletedFolderIds || [data.folderId]);
      folders.value = folders.value.filter((f) => !ids.has(f.id));
    }
  });

  ws.on('folder:shared', (payload) => {
    const data = payload as { folder: Folder };
    if (data?.folder && !folders.value.some((f) => f.id === data.folder.id)) {
      folders.value.push(data.folder);
    }
  });

  ws.on('folder:unshared', (payload) => {
    const data = payload as { folderId: string };
    if (data?.folderId) {
      folders.value = folders.value.filter((f) => f.id !== data.folderId);
    }
  });

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
