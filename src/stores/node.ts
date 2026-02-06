import { defineStore } from 'pinia';
import { ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { NodeVersion } from '../types';

export const useNodeStore = defineStore('node', () => {
  const versions = ref<NodeVersion[]>([]);
  const loading = ref(false);

  // Load custom nodes from local storage
  const loadCustomNodes = () => {
    const stored = localStorage.getItem('custom_nodes');
    if (stored) {
      try {
        const custom: NodeVersion[] = JSON.parse(stored);
        versions.value.push(...custom);
      } catch (e) {
        console.error('Failed to load custom nodes', e);
      }
    }
  };

  const loadNvmNodes = async () => {
    try {
      loading.value = true;
      const nvmNodes = await invoke<NodeVersion[]>('get_nvm_list');
      // Filter out existing nvm nodes to avoid duplicates if re-fetching
      versions.value = versions.value.filter(v => v.source !== 'nvm');
      versions.value.push(...nvmNodes);

      // Sort: System -> NVM -> Custom, then by version desc
      sortVersions();
    } catch (e) {
      console.error('Failed to load nvm nodes', e);
    } finally {
      loading.value = false;
    }
  };

  const sortVersions = () => {
    versions.value.sort((a, b) => {
      // Prioritize system
      if (a.source === 'system') return -1;
      if (b.source === 'system') return 1;

      // Then version descending
      const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
      const va = parse(a.version);
      const vb = parse(b.version);

      for (let i = 0; i < 3; i++) {
        if (va[i] !== vb[i]) return (vb[i] || 0) - (va[i] || 0);
      }
      return 0;
    });
  };

  const addCustomNode = (node: NodeVersion) => {
    versions.value.push(node);
    saveCustomNodes();
    sortVersions();
  };

  const removeNode = (path: string) => {
    versions.value = versions.value.filter(v => v.path !== path);
    saveCustomNodes();
  };

  const updateSystemNode = async (newPath: string) => {
    const idx = versions.value.findIndex(v => v.source === 'system');
    if (idx !== -1) {
      versions.value[idx].path = newPath;
      localStorage.setItem('system_node_path', newPath);

      // Try to detect version
      try {
        // We can invoke a command to check version, or just assume user knows.
        // But let's try to be smart.
        // Actually, for now let's just keep 'System Default' or update if we can.
        // But the user request is to show the version instead of "Default".
        // Since we don't have a backend command to get version from arbitrary path easily without spawning,
        // let's try to execute `node -v` using that path.

        if (newPath && newPath !== 'System Default') {
          const ver = await invoke<string>('get_node_version', { path: newPath });
          if (ver) {
            versions.value[idx].version = ver;
          }
        }
      } catch (e) {
        console.error('Failed to detect system node version', e);
      }
    }
  };

  const saveCustomNodes = () => {
    const custom = versions.value.filter(v => v.source === 'custom');
    localStorage.setItem('custom_nodes', JSON.stringify(custom));
  };

  const installNode = async (version: string) => {
    try {
      loading.value = true;
      await invoke('install_node', { version });
      // After install attempt, reload list to see if it actually appeared
      // We can't trust the exit code of 'cmd /C' fully because of the '|| pause' hack
      const previousCount = versions.value.filter(v => v.source === 'nvm').length;
      await loadNvmNodes();
      const newCount = versions.value.filter(v => v.source === 'nvm').length;

      if (newCount <= previousCount) {
        throw new Error('Node version not found after installation. Please check the console window for errors.');
      }
      return true;
    } catch (e: any) {
      console.error('Failed to install node', e);
      // If we threw the specific error above, rethrow it
      if (e.message && e.message.includes('Node version not found')) {
        throw e;
      }
      // Otherwise, since we are using "& pause", the exit code might be 0 even if it failed.
      // But if we caught an error here (e.g. from invoke), we should show it.
      throw e;
    } finally {
      loading.value = false;
    }
  };

  const uninstallNode = async (version: string) => {
    try {
      loading.value = true;
      await invoke('uninstall_node', { version });

      // Verification logic for uninstall
      const previousCount = versions.value.filter(v => v.source === 'nvm').length;
      await loadNvmNodes();
      const newCount = versions.value.filter(v => v.source === 'nvm').length;

      if (newCount >= previousCount) {
        throw new Error('Node version still exists after uninstallation. Please check the console window for errors.');
      }
      return true;
    } catch (e) {
      console.error('Failed to uninstall node', e);
      throw e;
    } finally {
      loading.value = false;
    }
  };

  onMounted(async () => {
    // Add default system node placeholder
    if (!versions.value.some(v => v.source === 'system')) {
      let savedPath = localStorage.getItem('system_node_path');

      // If no saved path, try to resolve it automatically
      if (!savedPath || savedPath === 'System Default') {
        try {
          const realPath = await invoke<string>('get_system_node_path');
          // Don't save it to localStorage yet, just use it for display
          // Or maybe saving it is better? 
          // Let's save it if it's not "System Default"
          if (realPath !== 'System Default') {
            savedPath = realPath;
            localStorage.setItem('system_node_path', realPath);
          } else {
            savedPath = 'System Default';
          }
        } catch (e) {
          savedPath = 'System Default';
        }
      }

      let version = '默认';

      try {
        const v = await invoke<string>('get_node_version', { path: savedPath });
        if (v) version = v;
      } catch (e) { }

      versions.value.push({
        version,
        path: savedPath!,
        source: 'system'
      });
    }
    loadCustomNodes();
    loadNvmNodes();
  });

  return {
    versions,
    loading,
    loadNvmNodes,
    addCustomNode,
    removeNode,
    updateSystemNode,
    installNode,
    uninstallNode
  };
});
