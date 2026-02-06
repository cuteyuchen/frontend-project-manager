<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core';
import type { Project } from '../types';
import { useSettingsStore } from '../stores/settings';

const props = defineProps<{ project: Project }>();
const settingsStore = useSettingsStore();

async function openEditor() {
  await invoke('open_in_editor', { 
    path: props.project.path, 
    editor: settingsStore.settings.editorPath 
  });
}

async function openFolder() {
  await invoke('open_folder', { path: props.project.path });
}

async function runScript(script: string) {
  if (!script) return;
  await invoke('run_script', {
    projectPath: props.project.path,
    script,
    nodeVersion: props.project.nodeVersion,
    packageManager: props.project.packageManager
  });
}

function runStartScript() {
  const startScript = props.project.scripts.find(s => s === 'dev' || s === 'start' || s === 'serve');
  if (startScript) {
    runScript(startScript);
  } else {
    // Fallback or alert
    alert('No start/dev script found');
  }
}
</script>

<template>
  <el-card class="group flex flex-col gap-3 !bg-[#1e293b]/80 !border-[#334155]/50 hover:!border-blue-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20 backdrop-blur-sm !rounded-xl relative overflow-hidden">
    <!-- Hover glow effect -->
    <div class="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-500"></div>
    
    <div class="flex justify-between items-start relative z-10">
      <div>
        <h3 class="text-lg font-bold text-gray-100 leading-tight truncate max-w-[150px] tracking-tight" :title="project.name">{{ project.name }}</h3>
        <el-tooltip :content="project.path" placement="top" :show-after="500">
             <div class="text-xs text-gray-400 mt-1.5 truncate max-w-[150px] cursor-help font-medium flex items-center gap-1 hover:text-blue-400 transition-colors">
                <div class="i-mdi-folder-outline text-[10px]" />
                {{ project.path.split(/[\\/]/).pop() }}
             </div>
        </el-tooltip>
      </div>
      <el-tag size="small" effect="dark" class="!bg-emerald-500/20 !text-emerald-300 !border-emerald-500/30 font-mono tracking-wider !rounded-md">{{ project.nodeVersion }}</el-tag>
    </div>
    
    <div class="flex items-center gap-2 mt-3 relative z-10">
       <el-tag size="small" effect="dark" class="!bg-slate-700/50 !text-slate-300 !border-slate-600 !rounded-md capitalize">
         <div class="flex items-center gap-1">
            <div class="i-mdi-package-variant-closed text-xs opacity-70" />
            {{ project.packageManager }}
         </div>
       </el-tag>
    </div>

    <div class="flex gap-2 mt-5 pt-3 border-t border-slate-700/50 relative z-10">
      <el-select 
        placeholder="选择脚本..." 
        size="small" 
        class="flex-1 !bg-transparent"
        @change="script => runScript(script)"
        :teleported="false"
      >
        <template #prefix><div class="i-mdi-script-text-outline text-gray-400" /></template>
        <el-option v-for="script in project.scripts" :key="script" :label="script" :value="script" />
      </el-select>
    </div>

    <div class="flex gap-2 justify-end mt-3 relative z-10">
      <el-tooltip content="在编辑器中打开" :show-after="500">
        <el-button circle size="small" class="!bg-blue-500/10 !border-blue-500/30 !text-blue-400 hover:!bg-blue-500 hover:!text-white transition-all" @click="openEditor">
            <el-icon><div class="i-mdi-code-tags" /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="启动项目 (dev/start)" :show-after="500">
        <el-button circle size="small" class="!bg-emerald-500/10 !border-emerald-500/30 !text-emerald-400 hover:!bg-emerald-500 hover:!text-white transition-all" @click="runStartScript">
             <el-icon><div class="i-mdi-play" /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="打开文件夹" :show-after="500">
         <el-button circle size="small" class="!bg-amber-500/10 !border-amber-500/30 !text-amber-400 hover:!bg-amber-500 hover:!text-white transition-all" @click="openFolder">
             <el-icon><div class="i-mdi-folder-open" /></el-icon>
         </el-button>
      </el-tooltip>
    </div>
  </el-card>
</template>

<style scoped>
:deep(.el-input__wrapper) {
  background-color: rgba(30, 41, 59, 0.5) !important;
  box-shadow: 0 0 0 1px rgba(51, 65, 85, 0.5) inset !important;
  transition: all 0.2s;
}
:deep(.el-input__wrapper:hover), :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.5) inset !important;
  background-color: rgba(30, 41, 59, 0.8) !important;
}
</style>
