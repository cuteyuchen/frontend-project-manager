<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useProjectStore } from '../stores/project';
import { useI18n } from 'vue-i18n';
import { AnsiUp } from 'ansi_up';
import { api } from '../api';

const { t } = useI18n();
const projectStore = useProjectStore();
const ansiUp = new AnsiUp();

function parseAnsi(text: string) {
    const html = ansiUp.ansi_to_html(text);
    // Match URLs but avoid matching HTML tags or attributes
    const urlRegex = /(https?:\/\/[^\s<"']+)/g;
    return html.replace(urlRegex, '<span class="log-link text-blue-400 hover:underline cursor-pointer" data-url="$1" title="Ctrl + Click to open">$1</span>');
}

function handleLogClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('log-link')) {
        const url = target.dataset.url;
        if (url && (event.ctrlKey || event.metaKey)) {
             api.openUrl(url);
        }
    }
}

const activeProject = computed(() =>
    projectStore.projects.find(p => p.id === projectStore.activeProjectId)
);

const activeScript = ref<string | null>(null);
const logContainer = ref<HTMLElement | null>(null);

// Keep track of active tabs explicitly
// We'll use a local state to track which tabs are "open"
// Tabs are opened when:
// 1. A script starts running
// 2. A script is manually clicked in the sidebar (ProjectListItem) -> wait, clicking there just runs it.
// 3. What if I want to see logs of a stopped script? 
// The user said: "After executing command on left, add tab on right".
// So we should add to 'openTabs' when runningStatus changes to true.

const openTabs = ref<Set<string>>(new Set());

// Watch for running scripts to auto-open tabs
watch(() => projectStore.runningStatus, (newStatus) => {
    if (!activeProject.value) return;

    Object.entries(newStatus).forEach(([key, running]) => {
        const prefix = `${activeProject.value?.id}:`;
        if (running && key.startsWith(prefix)) {
            const script = key.substring(prefix.length);
            if (!openTabs.value.has(script)) {
                openTabs.value.add(script);
                // If no active script, or if we want to auto-switch to newly started command?
                // User usually wants to see what they just ran.
                activeScript.value = script;
            }
        }
    });
}, { deep: true });

// Also populate openTabs from existing logs/running on mount/project change
watch(activeProject, (newP) => {
    openTabs.value.clear();
    activeScript.value = null;

    if (newP) {
        newP.scripts.forEach(s => {
            const key = `${newP.id}:${s}`;
            if (projectStore.runningStatus[key] || (projectStore.logs[key] && projectStore.logs[key].length > 0)) {
                openTabs.value.add(s);
            }
        });

        // Auto select first available
        if (openTabs.value.size > 0) {
            // Prefer running ones
            const running = Array.from(openTabs.value).find(s => projectStore.runningStatus[`${newP.id}:${s}`]);
            activeScript.value = running || Array.from(openTabs.value)[0];
        }
    }
}, { immediate: true });

const availableTabs = computed(() => {
    return Array.from(openTabs.value);
});

const logs = computed(() => {
    if (!activeProject.value || !activeScript.value) return [];
    // Use Object.freeze to avoid deep reactivity overhead on large arrays
    const allLogs = projectStore.logs[`${activeProject.value.id}:${activeScript.value}`] || [];
    // Return a frozen slice
    return allLogs.slice(-500);
});

const isRunning = computed(() => {
    if (!activeProject.value || !activeScript.value) return false;
    return projectStore.runningStatus[`${activeProject.value.id}:${activeScript.value}`] || false;
});

// Auto-scroll logic
// We want to scroll to bottom when new logs arrive, BUT only if we are already near bottom
// or if it's the first render.
// User requirement: "Always display the latest output at the bottom" (Run project always show newest output).
// This implies forcing scroll to bottom.

const scrollToBottom = () => {
    if (logContainer.value) {
        // Use scrollTop assignment directly which is synchronous
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
};

watch(() => logs.value.length, () => {
    // Only scroll if we are already near bottom or if explicitly needed?
    // Actually for "tail -f" behavior we usually want to force scroll unless user scrolled up.
    // But user reported "cannot see latest output in time" which implies we are NOT scrolling fast enough.
    // Let's use requestAnimationFrame for smoother but guaranteed updates
    requestAnimationFrame(() => {
        scrollToBottom();
    });
});

// Force scroll on script switch - INSTANTLY
watch(activeScript, () => {
    // We need to wait for Vue to render the new logs first
    nextTick(() => {
        // Force scroll multiple times to ensure layout is settled
        scrollToBottom();
        requestAnimationFrame(scrollToBottom);
    });
});

function handleStop() {
    if (activeProject.value && activeScript.value) {
        projectStore.stopProject(activeProject.value, activeScript.value);
    }
}

async function handleRestart() {
    if (activeProject.value && activeScript.value) {
        await projectStore.stopProject(activeProject.value, activeScript.value);
        // Wait a bit to ensure process is fully killed and ports released
        setTimeout(() => {
            if (activeProject.value && activeScript.value) {
                projectStore.runProject(activeProject.value, activeScript.value);
            }
        }, 1000);
    }
}

function handleClear() {
    if (activeProject.value && activeScript.value) {
        projectStore.clearLog(`${activeProject.value.id}:${activeScript.value}`);
    }
}

function handleRun(script: string) {
    if (activeProject.value) {
        projectStore.runProject(activeProject.value, script);
    }
}

function handleCloseTab(script: string) {
    // Stop the script if running
    if (activeProject.value && projectStore.runningStatus[`${activeProject.value.id}:${script}`]) {
        projectStore.stopProject(activeProject.value, script);
    }

    openTabs.value.delete(script);
    if (activeScript.value === script) {
        activeScript.value = Array.from(openTabs.value)[0] || null;
    }
}
</script>

<template>
    <div class="absolute inset-0 flex flex-col bg-slate-50 dark:bg-[#0f172a] text-slate-700 dark:text-slate-300 overflow-hidden transition-colors duration-300">
        <!-- Header -->
        <div v-if="activeProject"
            class="flex flex-col border-b border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-[#1e293b]/50 backdrop-blur-sm z-10">
            <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-4">
                    <h2 class="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{{ activeProject.name }}</h2>
                </div>
            </div>

            <!-- Tabs for outputs -->
            <div v-if="availableTabs.length > 0" class="flex px-4 gap-1 overflow-x-auto custom-scrollbar pt-2">
                <div v-for="script in availableTabs" :key="script" @click="activeScript = script"
                    class="group relative px-4 py-2 text-xs font-medium rounded-t-lg border-t border-x transition-all cursor-pointer select-none flex items-center gap-2 min-w-[100px] justify-between"
                    :class="activeScript === script 
                        ? 'bg-slate-50 dark:bg-[#0f172a] text-blue-600 dark:text-blue-400 border-slate-200 dark:border-slate-700/50 border-b-transparent z-10 shadow-sm' 
                        : 'bg-slate-200/50 dark:bg-slate-800/30 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-slate-200 dark:border-slate-700/50 hover:bg-slate-200/80 dark:hover:bg-slate-800/50 border-b-slate-200 dark:border-b-slate-700/50'">
                    <div class="flex items-center gap-2">
                        <span v-if="projectStore.runningStatus[`${activeProject.id}:${script}`]"
                            class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span>
                        <span v-else class="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                        {{ script }}
                    </div>

                    <button @click.stop="handleCloseTab(script)"
                        class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-300 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all">
                        <div class="i-mdi-close text-xs" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Logs Control Bar (only if script selected) -->
        <div v-if="activeScript"
            class="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800">
            <div class="text-xs text-slate-500 font-mono flex items-center gap-2">
                <span>Console: {{ activeScript }}</span>
                <span v-if="isRunning" class="text-emerald-500 flex items-center gap-1">
                    <div class="i-mdi-loading animate-spin" /> {{ t('dashboard.running') }}
                </span>
                <span v-else class="text-slate-400 dark:text-slate-600">{{ t('dashboard.stopped') }}</span>
            </div>
            <div class="flex gap-2">
                <button @click="handleClear" class="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Clear Logs">
                    <div class="i-mdi-delete-sweep text-base" />
                </button>
                <button v-if="isRunning" @click="handleRestart"
                    class="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded text-xs flex items-center gap-1 transition-all cursor-pointer">
                    <div class="i-mdi-restart text-xs" /> {{ t('dashboard.restart') }}
                </button>
                <button v-if="isRunning" @click="handleStop"
                    class="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded text-xs flex items-center gap-1 transition-all cursor-pointer">
                    <div class="i-mdi-stop text-xs" /> {{ t('dashboard.stop') }}
                </button>
                <button v-else @click="handleRun(activeScript!)"
                    class="px-2 py-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded text-xs flex items-center gap-1 transition-all cursor-pointer">
                    <div class="i-mdi-play text-xs" /> {{ t('dashboard.start') }}
                </button>
            </div>
        </div>

        <!-- Logs -->
        <div v-if="activeScript" ref="logContainer" @click="handleLogClick"
            class="flex-1 overflow-y-auto font-mono text-sm leading-relaxed whitespace-pre-wrap select-text relative min-h-0">
            <!-- Use a key to force re-render when switching scripts to avoid scroll artifacts -->
            <div :key="activeScript" class="p-4">
                <!-- Using index as key is fine for append-only logs, but for performance with huge lists, 
                     we might want to render just visible ones or use a virtual scroller. 
                     For now, let's just ensure we don't re-render everything unnecessarily. -->
                <div v-for="(line, i) in logs" :key="i"
                    class="break-all border-l-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 pl-2 -ml-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/30 transition-colors py-0.5"
                    v-html="parseAnsi(line)">
                </div>
            </div>

            <div v-if="logs.length === 0"
                class="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 absolute inset-0 pointer-events-none">
                <div class="i-mdi-console-line text-6xl mb-4 opacity-20" />
                <p>{{ t('dashboard.waitingForOutput') }}</p>
            </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <div class="w-24 h-24 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-6 shadow-inner">
                <div class="i-mdi-monitor-dashboard text-5xl opacity-30" />
            </div>
            <p class="text-lg font-medium text-slate-600 dark:text-slate-400">{{ t('dashboard.selectScript') }}</p>
            <p class="text-sm opacity-50 mt-2">{{ t('dashboard.clickRunHint') }}</p>
        </div>
    </div>
</template>

<style scoped>
/* Custom Scrollbar for Webkit (Chrome, Safari, Edge) */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1; /* slate-300 */
  border-radius: 4px;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background: #475569; /* slate-600 */
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8; /* slate-400 */
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #64748b; /* slate-500 */
}
</style>
