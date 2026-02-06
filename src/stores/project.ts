import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Project } from '../types';
import { useNodeStore } from './node';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const runningStatus = ref<Record<string, boolean>>({});
  const logs = ref<Record<string, string[]>>({});
  const activeProjectId = ref<string | null>(null);

  // Load from local storage on init
  const stored = localStorage.getItem('projects');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Sanitize data
        projects.value = parsed.map((p: any) => ({
          ...p,
          scripts: Array.isArray(p.scripts) ? p.scripts : []
        }));
      }
    } catch (e) {
      console.error('Failed to parse projects', e);
      projects.value = [];
    }
  }

  // Auto save
  watch(projects, (newVal) => {
    localStorage.setItem('projects', JSON.stringify(newVal));
  }, { deep: true });

  // Setup listeners
  listen<any>('project-output', (event) => {
      const { id, type, data } = event.payload;
      if (!logs.value[id]) logs.value[id] = [];
      logs.value[id].push(data);
  });

  listen<any>('project-exit', (event) => {
      const { id } = event.payload;
      runningStatus.value[id] = false;
      if (!logs.value[id]) logs.value[id] = [];
      logs.value[id].push('[Process exited]');
  });

  function addProject(project: Project) {
    projects.value.push(project);
  }

  function updateProject(project: Project) {
    const index = projects.value.findIndex(p => p.id === project.id);
    if (index !== -1) {
      projects.value[index] = project;
    }
  }

  function removeProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id);
    if (activeProjectId.value === id) activeProjectId.value = null;
  }

  async function runProject(project: Project, script: string) {
    if (runningStatus.value[project.id]) return;

    const nodeStore = useNodeStore();
    let nodePath = '';
    
    // Find matching node version
    if (project.nodeVersion) {
        // If it's a version string like "v18.0.0", find it
        const node = nodeStore.versions.find(v => v.version === project.nodeVersion);
        if (node) {
            nodePath = node.path;
        } else if (project.nodeVersion === '默认' || project.nodeVersion === 'Default') {
             // System default
             const systemNode = nodeStore.versions.find(v => v.source === 'system');
             if (systemNode) nodePath = systemNode.path;
        }
    }
    
    if (nodePath === 'System Default') nodePath = '';

    try {
        logs.value[project.id] = []; // Clear logs
        activeProjectId.value = project.id; // Auto select
        runningStatus.value[project.id] = true;
        
        await invoke('run_project_command', {
            id: project.id,
            path: project.path,
            script,
            packageManager: project.packageManager,
            nodePath
        });
    } catch (e) {
        console.error(e);
        runningStatus.value[project.id] = false;
        logs.value[project.id].push(`Error starting project: ${e}`);
    }
  }

  async function stopProject(id: string) {
      try {
          await invoke('stop_project_command', { id });
      } catch (e) {
          console.error(e);
      }
  }

  function clearLog(id: string) {
      logs.value[id] = [];
  }

  return {
    projects,
    runningStatus,
    logs,
    activeProjectId,
    addProject,
    updateProject,
    removeProject,
    runProject,
    stopProject,
    clearLog
  };
});
