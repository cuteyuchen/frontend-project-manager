import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { open as openDialogFn, save as saveDialogFn } from '@tauri-apps/plugin-dialog';
import { openUrl as openUrlFn } from '@tauri-apps/plugin-opener';
import { readTextFile as readTextFileFn, writeTextFile as writeTextFileFn } from '@tauri-apps/plugin-fs';
import type { PlatformAPI, ProjectInfo } from '../types';
import type { NodeVersion } from '../../types';

import { getCurrentWindow } from '@tauri-apps/api/window';

export class TauriAdapter implements PlatformAPI {
    private appWindow = getCurrentWindow();

    // NVM
    async getNvmList(): Promise<NodeVersion[]> {
        return invoke('get_nvm_list');
    }
    
    async installNode(version: string): Promise<string> {
        return invoke('install_node', { version });
    }
    
    async uninstallNode(version: string): Promise<string> {
        return invoke('uninstall_node', { version });
    }
    
    async useNode(version: string): Promise<string> {
        return invoke('use_node', { version });
    }
    
    async getSystemNodePath(): Promise<string> {
        return invoke('get_system_node_path');
    }

    async getNodeVersion(path: string): Promise<string> {
        return invoke('get_node_version', { path });
    }

    // Project
    async scanProject(path: string): Promise<ProjectInfo> {
        return invoke('scan_project', { path });
    }

    // Runner
    async runProjectCommand(id: string, path: string, script: string, packageManager: string, nodePath: string): Promise<void> {
        return invoke('run_project_command', { id, path, script, packageManager, nodePath });
    }
    
    async stopProjectCommand(id: string): Promise<void> {
        return invoke('stop_project_command', { id });
    }

    // System / Shell
    async openInEditor(path: string, editor?: string): Promise<void> {
        return invoke('open_in_editor', { path, editor });
    }
    
    async openFolder(path: string): Promise<void> {
        return invoke('open_folder', { path });
    }
    
    async openUrl(url: string): Promise<void> {
        // Prefer plugin if available, or backend if needed.
        // The project has both. Let's use the backend one if it does custom logic, 
        // or the plugin one if it's standard.
        // Settings.vue uses plugin.
        try {
            await openUrlFn(url);
        } catch (e) {
            // Fallback to invoke if plugin fails or if we prefer invoke
            return invoke('open_url', { url });
        }
    }

    // Config / FS
    async readConfigFile(filename: string): Promise<string> {
        return invoke('read_config_file', { filename });
    }
    
    async writeConfigFile(filename: string, content: string): Promise<void> {
        return invoke('write_config_file', { filename, content });
    }

    async readTextFile(path: string): Promise<string> {
        return readTextFileFn(path);
    }

    async writeTextFile(path: string, content: string): Promise<void> {
        return writeTextFileFn(path, content);
    }

    // Updater
    async installUpdate(url: string): Promise<void> {
        return invoke('install_update', { url });
    }
    
    async cancelUpdate(): Promise<void> {
        return invoke('cancel_update');
    }
    
    async getAppVersion(): Promise<string> {
        return getVersion();
    }

    // Dialogs
    async openDialog(options: any): Promise<string | string[] | null> {
        return openDialogFn(options);
    }
    
    async saveDialog(options: any): Promise<string | null> {
        return saveDialogFn(options);
    }

    // Events
    async onProjectOutput(callback: (payload: { id: string; data: string }) => void): Promise<() => void> {
        return listen<any>('project-output', (event) => {
            callback(event.payload);
        });
    }

    async onProjectExit(callback: (payload: { id: string }) => void): Promise<() => void> {
        return listen<any>('project-exit', (event) => {
            callback(event.payload);
        });
    }
    
    async onDownloadProgress(callback: (percentage: number) => void): Promise<() => void> {
        return listen<number>('download-progress', (event) => {
            callback(event.payload);
        });
    }

    // Window
    async windowMinimize(): Promise<void> {
        return this.appWindow.minimize();
    }

    async windowMaximize(): Promise<void> {
        return this.appWindow.maximize();
    }

    async windowUnmaximize(): Promise<void> {
        return this.appWindow.unmaximize();
    }

    async windowClose(): Promise<void> {
        return this.appWindow.close();
    }

    async windowIsMaximized(): Promise<boolean> {
        return this.appWindow.isMaximized();
    }

    async windowSetAlwaysOnTop(always: boolean): Promise<void> {
        return this.appWindow.setAlwaysOnTop(always);
    }

    async onWindowResize(callback: () => void): Promise<() => void> {
        return this.appWindow.listen('tauri://resize', callback);
    }
}
