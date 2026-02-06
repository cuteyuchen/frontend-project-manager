<script setup lang="ts">
import { ref } from 'vue';
import { useProjectStore } from '../stores/project';
import ProjectListItem from '../components/ProjectListItem.vue';
import ConsoleView from '../components/ConsoleView.vue';
import AddProjectModal from '../components/AddProjectModal.vue';
import type { Project } from '../types';

const projectStore = useProjectStore();
const showModal = ref(false);
const editingProject = ref<Project | null>(null);

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
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <!-- Project List Sidebar -->
    <div class="w-72 flex flex-col border-r border-slate-700/30 bg-[#0f172a]/95 backdrop-blur-xl z-20 shadow-2xl">
        <div class="p-4 border-b border-slate-700/30 flex justify-between items-center bg-[#0f172a]/50">
            <h2 class="text-base font-bold text-slate-100 tracking-wide uppercase text-xs opacity-80 pl-2">Projects</h2>
            <button @click="openAddModal" class="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20 group">
                <div class="i-mdi-plus text-lg group-hover:scale-110 transition-transform" />
            </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
             <ProjectListItem 
                v-for="project in projectStore.projects" 
                :key="project.id" 
                :project="project" 
                @edit="openEditModal(project)"
             />
             
             <div v-if="projectStore.projects.length === 0" class="text-center mt-20 text-slate-500">
                <div class="i-mdi-folder-open-outline text-5xl mb-3 opacity-20 mx-auto" />
                <p class="text-sm">No projects yet</p>
                <p class="text-xs opacity-50 mt-1">Add one to get started</p>
             </div>
        </div>
    </div>

    <!-- Main Console Area -->
    <div class="flex-1 overflow-hidden relative bg-[#0b1120] shadow-inner">
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
  background: #334155;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
