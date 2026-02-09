<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { ElMessageBox, ElMessage, ElLoading } from 'element-plus';
import { useI18n } from 'vue-i18n';
import Sidebar from './components/Sidebar.vue';
import Dashboard from './views/Dashboard.vue';
import Settings from './views/Settings.vue';
import NodeManager from './views/NodeManager.vue';
import { loadData, saveData } from './utils/persistence';
import { useProjectStore } from './stores/project';
import { useSettingsStore } from './stores/settings';
import { useNodeStore } from './stores/node';

const { t } = useI18n();
const currentView = ref<'dashboard' | 'settings' | 'nodes'>('dashboard');
const loaded = ref(false);

function compareVersions(v1: string, v2: string) {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

async function checkUpdate() {
  try {
    const response = await fetch('https://api.github.com/repos/cuteyuchen/frontend-project-manager/releases/latest');
    if (!response.ok) return;
    const data = await response.json();
    const latestTag = data.tag_name; // e.g., "v0.1.1"
    const remoteVersion = latestTag.replace(/^v/, '');
    const localVersion = await getVersion();

    if (compareVersions(remoteVersion, localVersion) > 0) {
      ElMessageBox.confirm(
        t('update.message', { version: latestTag }),
        t('update.title'),
        {
          confirmButtonText: t('update.confirm'),
          cancelButtonText: t('update.cancel'),
          type: 'info',
        }
      ).then(async () => {
        const loading = ElLoading.service({
          lock: true,
          text: t('update.downloading'),
          background: 'rgba(0, 0, 0, 0.7)',
        });

        try {
          const downloadUrl = `https://github.com/cuteyuchen/frontend-project-manager/releases/download/${latestTag}/frontend-manager.exe`;
          await invoke('install_update', { url: downloadUrl });
        } catch (error) {
          loading.close();
          ElMessage.error(t('update.error', { error }));
        }
      }).catch(() => { });
    }
  } catch (e) {
    console.error('Failed to check for updates:', e);
  }
}

onMounted(async () => {
  await loadData();
  loaded.value = true;
  
  // Auto refresh projects
  useProjectStore().refreshAll();
  
  if (useSettingsStore().settings.autoUpdate !== false) {
    checkUpdate();
  }
});

// Watch stores and save
const projectStore = useProjectStore();
const settingsStore = useSettingsStore();
const nodeStore = useNodeStore();

let saveTimer: any = null;
const triggerSave = () => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveData();
  }, 1000);
};

watch(() => projectStore.projects, triggerSave, { deep: true });
watch(() => settingsStore.settings, triggerSave, { deep: true });
watch(() => nodeStore.versions, triggerSave, { deep: true });
</script>

<template>
  <div
    class="flex h-screen w-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-gray-100 font-sans overflow-hidden select-none transition-colors duration-300 antialiased">
    <Sidebar @navigate="v => currentView = v" />
    <main class="flex-1 h-full overflow-hidden relative">
      <!-- Modern deep gradient background -->
      <div
        class="absolute inset-0 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 dark:from-[#0f172a] dark:via-[#1e293b] dark:to-[#0f172a] opacity-100 pointer-events-none transition-colors duration-300" />
      <!-- Subtle accent glow -->
      <div
        class="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none">
      </div>
      <div
        class="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none">
      </div>

      <div class="relative h-full z-10 backdrop-blur-[0px]">
        <Dashboard v-if="currentView === 'dashboard'" />
        <Settings v-if="currentView === 'settings'" />
        <NodeManager v-if="currentView === 'nodes'" />
      </div>
    </main>
  </div>
</template>

<style>
:root {
  font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

html.dark {
  color-scheme: dark;
  --el-bg-color: #1e293b !important;
  --el-bg-color-overlay: #1e293b !important;
  --el-border-color: #334155 !important;
  --el-border-color-light: #334155 !important;
  --el-border-color-lighter: #334155 !important;
  --el-text-color-primary: #f1f5f9 !important;
  --el-text-color-regular: #cbd5e1 !important;
  --el-fill-color-blank: #0f172a !important;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background-color: transparent;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.dark ::-webkit-scrollbar-thumb {
  background: #334155;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
