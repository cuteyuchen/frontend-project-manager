import { defineStore } from 'pinia';
import { ref, watch, onMounted } from 'vue';
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

  const updateSystemNode = (newPath: string) => {
    const idx = versions.value.findIndex(v => v.source === 'system');
    if (idx !== -1) {
        versions.value[idx].path = newPath;
        localStorage.setItem('system_node_path', newPath);
    }
  };

  const saveCustomNodes = () => {
    const custom = versions.value.filter(v => v.source === 'custom');
    localStorage.setItem('custom_nodes', JSON.stringify(custom));
  };

  onMounted(() => {
    // Add default system node placeholder
    if (!versions.value.some(v => v.source === 'system')) {
        const savedPath = localStorage.getItem('system_node_path') || 'System Default';
        versions.value.push({
            version: '默认',
            path: savedPath,
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
    updateSystemNode
  };
});
