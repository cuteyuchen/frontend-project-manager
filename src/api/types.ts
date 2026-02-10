import type { NodeVersion } from '../types';

export interface ProjectInfo {
    name: string;
    scripts: string[];
    path: string;
}

export interface PlatformAPI {
    // NVM
    getNvmList(): Promise<NodeVersion[]>;
    installNode(version: string): Promise<string>;
    uninstallNode(version: string): Promise<string>;
    useNode(version: string): Promise<string>;
    getSystemNodePath(): Promise<string>;
    getNodeVersion(path: string): Promise<string>;

    // Project
    scanProject(path: string): Promise<ProjectInfo>;

    // Runner
    runProjectCommand(id: string, path: string, script: string, packageManager: string, nodePath: string): Promise<void>;
    stopProjectCommand(id: string): Promise<void>;

    // System / Shell
    openInEditor(path: string, editor?: string): Promise<void>;
    openFolder(path: string): Promise<void>;
    openUrl(url: string): Promise<void>;

    // Config / FS
    readConfigFile(filename: string): Promise<string>;
    writeConfigFile(filename: string, content: string): Promise<void>;
    readTextFile(path: string): Promise<string>;
    writeTextFile(path: string, content: string): Promise<void>;

    // Updater
    installUpdate(url: string): Promise<void>;
    cancelUpdate(): Promise<void>;
    getAppVersion(): Promise<string>;

    // Dialogs
    openDialog(options?: {
        directory?: boolean;
        multiple?: boolean;
        filters?: { name: string; extensions: string[] }[];
        defaultPath?: string;
    }): Promise<string | string[] | null>;
    
    saveDialog(options?: {
        filters?: { name: string; extensions: string[] }[];
        defaultPath?: string;
    }): Promise<string | null>;

    // Events
    onProjectOutput(callback: (payload: { id: string; data: string }) => void): Promise<() => void>;
    onProjectExit(callback: (payload: { id: string }) => void): Promise<() => void>;
    onDownloadProgress(callback: (percentage: number) => void): Promise<() => void>;

    // Window
    windowMinimize(): Promise<void>;
    windowMaximize(): Promise<void>;
    windowUnmaximize(): Promise<void>;
    windowClose(): Promise<void>;
    windowIsMaximized(): Promise<boolean>;
    windowSetAlwaysOnTop(always: boolean): Promise<void>;
    onWindowResize(callback: () => void): Promise<() => void>;
}
