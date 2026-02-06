<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useProjectStore } from '../stores/project';

const projectStore = useProjectStore();
const activeProject = computed(() => 
    projectStore.projects.find(p => p.id === projectStore.activeProjectId)
);

const logs = computed(() => {
    if (!activeProject.value) return [];
    return projectStore.logs[activeProject.value.id] || [];
});

const isRunning = computed(() => {
    if (!activeProject.value) return false;
    return projectStore.runningStatus[activeProject.value.id] || false;
});

const logContainer = ref<HTMLElement | null>(null);

watch(() => logs.value.length, () => {
    nextTick(() => {
        if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
    });
}, { immediate: true });

// Also scroll when active project changes
watch(activeProject, () => {
    nextTick(() => {
        if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
    });
});

function handleStop() {
    if (activeProject.value) {
        projectStore.stopProject(activeProject.value.id);
    }
}

function handleClear() {
    if (activeProject.value) {
        projectStore.clearLog(activeProject.value.id);
    }
}
</script>

<template>
    <div class="h-full flex flex-col bg-[#0f172a] text-slate-300 relative overflow-hidden">
        <!-- Header -->
        <div v-if="activeProject" class="flex items-center justify-between p-4 border-b border-slate-700/50 bg-[#1e293b]/50 backdrop-blur-sm z-10">
            <div class="flex items-center gap-4">
                <h2 class="text-lg font-bold text-white tracking-tight">{{ activeProject.name }}</h2>
                <div class="flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all"
                     :class="isRunning 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-700/50 text-slate-400 border-slate-600/50'">
                    <div class="w-1.5 h-1.5 rounded-full" :class="isRunning ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-500'" />
                    {{ isRunning ? 'Running' : 'Stopped' }}
                </div>
            </div>
            <div class="flex gap-2">
                 <button @click="handleClear" class="p-2 hover:bg-slate-700/50 rounded-lg text-slate-400 transition-colors" title="Clear Logs">
                    <div class="i-mdi-delete-sweep text-lg" />
                </button>
                <button v-if="isRunning" @click="handleStop" class="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg flex items-center gap-2 transition-all hover:shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                    <div class="i-mdi-stop text-sm" /> Stop
                </button>
            </div>
        </div>
        
        <!-- Logs -->
        <div v-if="activeProject" ref="logContainer" class="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap select-text scroll-smooth">
            <div v-for="(line, i) in logs" :key="i" class="break-all border-l-2 border-transparent hover:border-slate-700 pl-2 -ml-2 hover:bg-slate-800/30 transition-colors py-0.5">{{ line }}</div>
            <div v-if="logs.length === 0" class="h-full flex flex-col items-center justify-center text-slate-600">
                <div class="i-mdi-console-line text-6xl mb-4 opacity-20" />
                <p>Ready to capture output...</p>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="h-full flex flex-col items-center justify-center text-slate-500">
            <div class="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 shadow-inner">
                <div class="i-mdi-monitor-dashboard text-5xl opacity-30" />
            </div>
            <p class="text-lg font-medium text-slate-400">Select a project to view console</p>
            <p class="text-sm opacity-50 mt-2">Click on a project from the left sidebar</p>
        </div>
    </div>
</template>
