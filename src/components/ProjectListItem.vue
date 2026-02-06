<script setup lang="ts">
import type { Project } from '../types';
import { useProjectStore } from '../stores/project';
import { useSettingsStore } from '../stores/settings';
import { computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { ElMessage, ElMessageBox } from 'element-plus';

const props = defineProps<{ project: Project }>();
const emit = defineEmits(['edit']);
const store = useProjectStore();
const settingsStore = useSettingsStore();

const isActive = computed(() => store.activeProjectId === props.project.id);
const isRunning = computed(() => {
    // Check if any script in this project is running
    if (!props.project.scripts) return false;
    return props.project.scripts.some(s => store.runningStatus[`${props.project.id}:${s}`]);
});

function handleClick() {
    store.activeProjectId = props.project.id;
}

function handleRun(script: string) {
    store.runProject(props.project, script);
}

function handleDelete() {
    ElMessageBox.confirm(
        '确定要移除该项目吗？',
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning',
            customClass: 'dark-message-box'
        }
    )
        .then(() => {
            store.removeProject(props.project.id);
            ElMessage.success('项目已移除');
        })
        .catch(() => { });
}

async function openEditor() {
    try {
        await invoke('open_in_editor', {
            path: props.project.path,
            editor: settingsStore.settings.editorPath
        });
    } catch (e) {
        console.error(e);
        ElMessage.error(`无法打开编辑器: ${e}`);
    }
}

async function openFolder() {
    try {
        await invoke('open_folder', { path: props.project.path });
    } catch (e) {
        console.error(e);
        ElMessage.error(`无法打开文件夹: ${e}`);
    }
}
</script>

<template>
    <div @click="handleClick"
        class="p-4 rounded-xl cursor-pointer transition-all border group relative overflow-hidden mb-3" :class="isActive
            ? 'bg-blue-600/10 border-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.1)]'
            : 'bg-[#1e293b]/40 border-slate-800 hover:bg-[#1e293b]/80 hover:border-slate-700'">
        <div class="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex gap-1">
            <button @click.stop="openEditor"
                class="p-1 text-slate-400 hover:text-blue-400 transition-colors rounded hover:bg-slate-700/50"
                title="在编辑器中打开">
                <div class="i-mdi-code-tags text-sm" />
            </button>
            <button @click.stop="openFolder"
                class="p-1 text-slate-400 hover:text-amber-400 transition-colors rounded hover:bg-slate-700/50"
                title="打开文件夹">
                <div class="i-mdi-folder-open text-sm" />
            </button>
            <button @click.stop="$emit('edit')"
                class="p-1 text-slate-400 hover:text-emerald-400 transition-colors rounded hover:bg-slate-700/50"
                title="编辑项目">
                <div class="i-mdi-pencil text-sm" />
            </button>
            <button @click.stop="handleDelete"
                class="p-1 text-slate-400 hover:text-red-400 transition-colors rounded hover:bg-slate-700/50"
                title="移除项目">
                <div class="i-mdi-delete text-sm" />
            </button>
        </div>

        <div class="flex justify-between items-center mb-1">
            <h3 class="font-bold text-sm truncate pr-20" :class="isActive ? 'text-blue-400' : 'text-slate-200'">{{
                project.name }}</h3>
            <div class="flex-shrink-0">
                <div v-if="isRunning"
                    class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse">
                </div>
            </div>
        </div>

        <div class="text-xs text-slate-500 truncate font-mono mb-3 opacity-80 pr-6">{{ project.path }}</div>

        <div class="flex flex-wrap gap-2 relative z-10"
            v-if="(isActive || isRunning) && project.scripts && project.scripts.length">
            <button v-for="script in project.scripts" :key="script" @click.stop="handleRun(script)"
                :disabled="store.runningStatus[`${project.id}:${script}`]"
                class="px-2 py-1 text-[10px] rounded border transition-all uppercase tracking-wider font-medium"
                :class="script === 'dev' || script === 'start' || script === 'serve'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'">
                {{ script }}
            </button>
        </div>
    </div>
</template>
