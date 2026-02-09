import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api';
import type { Project } from '../types';
import { useNodeStore } from './node';

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]);
  const runningStatus = ref<Record<string, boolean>>({});
  const logs = ref<Record<string, string[]>>({});
  const activeProjectId = ref<string | null>(null);

  // Load from local storage removed in favor of persistence.ts
  
  // Setup listeners
  api.onProjectOutput(({ id, data }) => {
      // Extract the script identifier from the ID if possible, but here id is usually project_id
      // We actually need to store logs per project_id, but running status per script?
      // Wait, the rust side receives "id" which is project.id.
      // If we want multiple scripts per project, we need unique IDs for rust processes.
      // Let's change the ID passed to rust to be `${project.id}:${script}`
      
      // But we need to handle legacy or parse it back.
      // Actually, if we change the ID passed to invoke, we get events with that composite ID.
      // So we should store logs keyed by that composite ID? 
      // Or maybe we still want all logs for a project in one place?
      // The user asked "Single project can run multiple commands simultaneously".
      // So we need to distinguish them.
      
      if (!logs.value[id]) logs.value[id] = [];
      logs.value[id].push(data);
  });

  api.onProjectExit(({ id }) => {
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
    const runId = `${project.id}:${script}`;
    
    if (runningStatus.value[runId]) return;

    const nodeStore = useNodeStore();
    
    // Ensure node versions are loaded
    if (nodeStore.versions.length === 0) {
        await nodeStore.loadNvmNodes();
    }
    
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
        // Initialize logs for this runId if needed, or clear if we want fresh logs per run
        // But maybe user wants to see history?
        // Let's clear for now to avoid confusion.
        logs.value[runId] = []; 
        
        activeProjectId.value = project.id; // Auto select project
        runningStatus.value[runId] = true;
        
        // Log debug info
        logs.value[runId].push(`[Runner] Starting script: ${script}`);
        logs.value[runId].push(`[Runner] Selected Node Version: ${project.nodeVersion || 'None'}`);
        logs.value[runId].push(`[Runner] Resolved Node Path: ${nodePath || 'System Default'}`);
        
        await api.runProjectCommand(
            runId,
            project.path,
            script,
            project.packageManager,
            nodePath
        );
    } catch (e) {
        console.error(e);
        runningStatus.value[runId] = false;
        logs.value[runId].push(`Error starting project: ${e}`);
    }
  }

  async function stopProject(project: Project, script: string) {
      const runId = `${project.id}:${script}`;
      try {
          await api.stopProjectCommand(runId);
      } catch (e) {
          console.error(e);
      }
  }

  function clearLog(runId: string) {
      logs.value[runId] = [];
  }

  async function refreshAll() {
    const updates = await Promise.all(projects.value.map(async (p) => {
        try {
            const info: any = await api.scanProject(p.path);
            return { ...p, scripts: info.scripts || [] };
        } catch (e) {
            console.error(`Failed to refresh project ${p.name}`, e);
            return p;
        }
    }));
    projects.value = updates;
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
    clearLog,
    refreshAll
  };
});
