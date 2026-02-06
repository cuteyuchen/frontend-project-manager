import { exists, readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { useProjectStore } from '../stores/project';
import { useSettingsStore } from '../stores/settings';
import { useNodeStore } from '../stores/node';

const FILE_NAME = 'data.json';

export async function saveData() {
  try {
    const projectStore = useProjectStore();
    const settingsStore = useSettingsStore();
    const nodeStore = useNodeStore();

    const data = {
      projects: projectStore.projects,
      settings: settingsStore.settings,
      customNodes: nodeStore.versions.filter(v => v.source === 'custom')
    };

    // Ensure the AppConfig directory exists
    // BaseDirectory.AppConfig maps to AppData/Roaming/com.identifier
    try {
        await mkdir('', { baseDir: BaseDirectory.AppConfig, recursive: true });
    } catch (e) {
        // Ignore error if it already exists or if we can't create it (writeTextFile might fail then)
    }
    
    await writeTextFile(FILE_NAME, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.AppConfig });
    console.log('Data saved to', FILE_NAME);
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

export async function loadData() {
  try {
    const existsFile = await exists(FILE_NAME, { baseDir: BaseDirectory.AppConfig });
    if (!existsFile) return;

    const content = await readTextFile(FILE_NAME, { baseDir: BaseDirectory.AppConfig });
    const data = JSON.parse(content);

    if (data.projects) {
      const projectStore = useProjectStore();
      projectStore.projects = data.projects;
    }
    if (data.settings) {
      const settingsStore = useSettingsStore();
      settingsStore.settings = data.settings;
    }
    if (data.customNodes) {
      const nodeStore = useNodeStore();
      // Merge custom nodes
      const existing = new Set(nodeStore.versions.map(v => v.path));
      data.customNodes.forEach((n: any) => {
          if (!existing.has(n.path)) {
              nodeStore.versions.push(n);
          }
      });
    }
    console.log('Data loaded');
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}
