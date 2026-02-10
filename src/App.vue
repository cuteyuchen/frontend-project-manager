<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, h } from 'vue';
import { api } from './api';
import { ElMessageBox, ElMessage, ElLoading } from 'element-plus';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useI18n } from 'vue-i18n';
import Sidebar from './components/Sidebar.vue';
import Dashboard from './views/Dashboard.vue';
import Settings from './views/Settings.vue';
import NodeManager from './views/NodeManager.vue';
import TitleBar from './components/TitleBar.vue';
import { loadData, saveData } from './utils/persistence';
import { useProjectStore } from './stores/project';
import { useSettingsStore } from './stores/settings';
import { useNodeStore } from './stores/node';
import type { Project } from './types';

const target = import.meta.env.VITE_TARGET;

const { t } = useI18n();
const currentView = ref<'dashboard' | 'settings' | 'nodes'>('dashboard');
const loaded = ref(false);
const isDragging = ref(false);
let unlistenDragEnter: UnlistenFn | null = null;
let unlistenDragLeave: UnlistenFn | null = null;
let unlistenDragDrop: UnlistenFn | null = null;

async function handleImportProject(path: string) {
  const store = useProjectStore();
  if (store.projects.some(p => p.path === path)) {
    ElMessage.warning(t('project.alreadyExists') || 'Project already exists');
    return;
  }

  const loading = ElLoading.service({
    lock: true,
    text: 'Scanning...',
    background: 'rgba(0, 0, 0, 0.7)',
  });

  try {
    const info = await api.scanProject(path);
    const project: Project = {
      id: crypto.randomUUID(),
      name: info.name || path.split(/[\\/]/).pop() || 'Untitled',
      path: path,
      type: 'node',
      nodeVersion: '',
      packageManager: 'npm',
      scripts: info.scripts
    };
    store.addProject(project);
    ElMessage.success(t('dashboard.addProject') + ' Success');
  } catch (e) {
    ElMessage.error('Failed to import: ' + e);
  } finally {
    loading.close();
  }
}

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
    const localVersion = await api.getAppVersion();

    if (compareVersions(remoteVersion, localVersion) > 0) {
      ElMessageBox.confirm(
        h('div', null, [
          h('p', null, t('update.message', { version: latestTag })),
          h('div', { class: 'mt-2' }, [
            h('a', {
              class: 'text-blue-500 hover:text-blue-600 cursor-pointer underline',
              onClick: (e: Event) => {
                e.preventDefault();
                api.openUrl('https://github.com/cuteyuchen/frontend-project-manager/releases');
              }
            }, 'Open Download Page')
          ])
        ]),
        t('update.title'),
        {
          confirmButtonText: t('update.confirm'),
          cancelButtonText: t('update.cancel'),
          type: 'info',
        }
      ).then(async () => {
        const loading = ElLoading.service({
          lock: true,
          text: `${t('update.downloading')} 0%`,
          background: 'rgba(0, 0, 0, 0.7)',
        });

        let unlisten: (() => void) | undefined;

        try {
          unlisten = await api.onDownloadProgress((percentage) => {
             loading.setText(`${t('update.downloading')} ${percentage}%`);
          });

          const downloadUrl = `https://github.com/cuteyuchen/frontend-project-manager/releases/download/${latestTag}/Frontend.Project.Manager_${latestTag.replace(/^v/, '')}_x64-setup.exe`;
          await api.installUpdate(downloadUrl);
        } catch (error) {
          ElMessage.error(t('update.error', { error }));
        } finally {
          if (unlisten) unlisten();
          loading.close();
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
  
  // Handle Startup Args / uTools Plugin Enter
  if (target === 'utools') {
    if ((window as any).utools) {
      (window as any).utools.onPluginEnter(({ code, type, payload }: any) => {
        if (code === 'import_project' && type === 'files' && payload.length > 0) {
          handleImportProject(payload[0].path);
        }
      });
    }

    // Web/uTools Drag and Drop
    let dragCounter = 0;
    
    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        isDragging.value = true;
      }
    });

    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        isDragging.value = false;
      }
    });

    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.value = false;
      dragCounter = 0;
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
           const file = files[i] as any;
           // In Electron/uTools, File object has a 'path' property
           if (file.path) {
             await handleImportProject(file.path);
           }
        }
      }
    });
  } else {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const args = await invoke<string[]>('get_startup_args');
      if (args && args.length > 1) {
        const potentialPath = args[1];
        if (!potentialPath.startsWith('-')) {
          handleImportProject(potentialPath);
        }
      }
    } catch (e) {
      console.error('Failed to get startup args:', e);
    }

    // Setup Drag and Drop Listeners
    try {
      const { listen } = await import('@tauri-apps/api/event');
      
      unlistenDragEnter = await listen('tauri://drag-enter', () => {
        isDragging.value = true;
      });
      
      unlistenDragLeave = await listen('tauri://drag-leave', () => {
        isDragging.value = false;
      });
      
      unlistenDragDrop = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        isDragging.value = false;
        if (event.payload.paths && event.payload.paths.length > 0) {
           for (const path of event.payload.paths) {
             handleImportProject(path);
           }
        }
      });
    } catch (e) {
      console.error('Failed to setup drag listeners', e);
    }
  }

  // Default to true if undefined (legacy support)
  if (target !== 'utools' && useSettingsStore().settings.autoUpdate !== false) {
    checkUpdate();
  }
});

onUnmounted(() => {
  if (unlistenDragEnter) unlistenDragEnter();
  if (unlistenDragLeave) unlistenDragLeave();
  if (unlistenDragDrop) unlistenDragDrop();
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
  <div class="h-screen w-screen flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-gray-100 font-sans overflow-hidden select-none transition-colors duration-300 antialiased">
    <TitleBar v-if="target !== 'utools'" />
    
    <div class="flex-1 flex overflow-hidden relative">
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
        
        <!-- Drag Overlay -->
        <div v-if="isDragging" class="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-xl transition-all duration-300">
          <div class="text-center text-white">
             <div class="text-6xl mb-4 text-blue-400 flex justify-center">
               <div class="i-mdi-folder-upload" />
             </div>
             <h2 class="text-2xl font-bold">{{ t('dashboard.dropToImport') || 'Drop folder to import' }}</h2>
          </div>
        </div>
      </main>
    </div>
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
