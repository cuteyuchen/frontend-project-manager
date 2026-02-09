<script setup lang="ts">
import { ref } from 'vue';
import { useProjectStore } from '../stores/project';
import ProjectListItem from '../components/ProjectListItem.vue';
import ConsoleView from '../components/ConsoleView.vue';
import AddProjectModal from '../components/AddProjectModal.vue';
import type { Project } from '../types';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const projectStore = useProjectStore();
const showModal = ref(false);
const editingProject = ref<Project | null>(null);
const refreshing = ref(false);

function handleAdd(project: Project) {
  projectStore.addProject(project);
}

function handleUpdate(project: Project) {
  projectStore.updateProject(project);
  editingProject.value = null;
}

function openAddModal() {
    editingProject.value = null;
    showModal.value = true;
}

function openEditModal(project: Project) {
    editingProject.value = project;
    showModal.value = true;
}

async function refreshProjects() {
    refreshing.value = true;
    try {
        await projectStore.refreshAll();
    } finally {
        refreshing.value = false;
    }
}
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <!-- Project List Sidebar -->
    <div class="w-72 flex flex-col border-r border-slate-200 dark:border-slate-700/30 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl z-20 shadow-2xl transition-colors duration-300">
        <div class="p-4 border-b border-slate-200 dark:border-slate-700/30 flex justify-between items-center bg-white/50 dark:bg-[#0f172a]/50">
            <h2 class="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide uppercase text-xs opacity-80 pl-2">{{ t('dashboard.title') }}</h2>
            <div class="flex gap-2">
                <button @click="refreshProjects" :disabled="refreshing" class="p-1.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500 hover:text-white transition-all border border-slate-500/20 group cursor-pointer disabled:opacity-50" :title="t('common.refresh') || 'Refresh'">
                    <div class="i-mdi-refresh text-lg transition-transform duration-700" :class="{ 'animate-spin': refreshing }" />
                </button>
                <button @click="openAddModal" class="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 group cursor-pointer" :title="t('dashboard.addProject')">
                    <div class="i-mdi-plus text-lg group-hover:scale-110 transition-transform" />
                </button>
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
             <ProjectListItem 
                v-for="project in projectStore.projects" 
                :key="project.id" 
                :project="project" 
                @edit="openEditModal(project)"
             />
             
             <div v-if="projectStore.projects.length === 0" class="text-center mt-20 text-slate-400 dark:text-slate-500">
                <div class="i-mdi-folder-open-outline text-5xl mb-3 opacity-20 mx-auto" />
                <p class="text-sm font-medium">{{ t('dashboard.noProjects') }}</p>
                <p class="text-xs opacity-50 mt-1">{{ t('dashboard.addProject') }}</p>
             </div>
        </div>
    </div>

    <!-- Main Console Area -->
    <div class="flex-1 overflow-hidden relative bg-slate-50 dark:bg-[#0b1120] shadow-inner transition-colors duration-300">
        <ConsoleView />
    </div>

    <AddProjectModal 
        v-model="showModal" 
        :edit-project="editingProject"
        @add="handleAdd" 
        @update="handleUpdate"
    />
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
