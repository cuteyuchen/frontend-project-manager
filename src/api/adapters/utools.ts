import type { PlatformAPI, ProjectInfo } from '../types';
import type { NodeVersion } from '../../types';

// Declare global interface for uTools services
declare global {
  interface Window {
    services: PlatformAPI;
  }
}

export class UToolsAdapter implements PlatformAPI {
  private get service() {
    if (!window.services) {
        console.warn('uTools services not found on window object. Are you running in uTools?');
        // Return a mock or throw? Throwing is better to catch issues.
        // For development outside uTools but selecting this adapter, we might fail.
        throw new Error('uTools services not initialized');
    }
    return window.services;
  }

  getNvmList(): Promise<NodeVersion[]> { return this.service.getNvmList(); }
  installNode(version: string): Promise<string> { return this.service.installNode(version); }
  uninstallNode(version: string): Promise<string> { return this.service.uninstallNode(version); }
  useNode(version: string): Promise<string> { return this.service.useNode(version); }
  getSystemNodePath(): Promise<string> { return this.service.getSystemNodePath(); }
  getNodeVersion(path: string): Promise<string> { return this.service.getNodeVersion(path); }

  scanProject(path: string): Promise<ProjectInfo> { return this.service.scanProject(path); }

  runProjectCommand(id: string, path: string, script: string, packageManager: string, nodePath: string): Promise<void> {
    return this.service.runProjectCommand(id, path, script, packageManager, nodePath);
  }
  stopProjectCommand(id: string): Promise<void> { return this.service.stopProjectCommand(id); }

  openInEditor(path: string, editor?: string): Promise<void> { return this.service.openInEditor(path, editor); }
  openFolder(path: string): Promise<void> { return this.service.openFolder(path); }
  openUrl(url: string): Promise<void> { return this.service.openUrl(url); }

  readConfigFile(filename: string): Promise<string> { return this.service.readConfigFile(filename); }
  writeConfigFile(filename: string, content: string): Promise<void> { return this.service.writeConfigFile(filename, content); }
  readTextFile(path: string): Promise<string> { return this.service.readTextFile(path); }
  writeTextFile(path: string, content: string): Promise<void> { return this.service.writeTextFile(path, content); }

  installUpdate(url: string): Promise<void> { return this.service.installUpdate(url); }
  cancelUpdate(): Promise<void> { return this.service.cancelUpdate ? this.service.cancelUpdate() : Promise.resolve(); }
  getAppVersion(): Promise<string> { return this.service.getAppVersion(); }

  openDialog(options: any): Promise<string | string[] | null> { return this.service.openDialog(options); }
  saveDialog(options: any): Promise<string | null> { return this.service.saveDialog(options); }

  onProjectOutput(callback: (payload: { id: string; data: string }) => void): Promise<() => void> {
    return this.service.onProjectOutput(callback);
  }
 async onProjectExit(callback: (payload: { id: string }) => void): Promise<() => void> {
    return this.service.onProjectExit(callback);
  }

  async onDownloadProgress(callback: (percentage: number) => void): Promise<() => void> {
      return this.service.onDownloadProgress(callback);
  }

  // Window
  async windowMinimize(): Promise<void> {
      // utools.hideMainWindow();
      return Promise.resolve();
  }

  async windowMaximize(): Promise<void> {
      return Promise.resolve();
  }

  async windowUnmaximize(): Promise<void> {
      return Promise.resolve();
  }

  async windowClose(): Promise<void> {
      // utools.outPlugin();
      return Promise.resolve();
  }

  async windowIsMaximized(): Promise<boolean> {
      return Promise.resolve(true);
  }

  async windowSetAlwaysOnTop(always: boolean): Promise<void> {
      console.log('windowSetAlwaysOnTop', always);
      return Promise.resolve();
  }

  async onWindowResize(callback: () => void): Promise<() => void> {
      console.log('onWindowResize registered', callback);
      return Promise.resolve(() => {});
  }

  // System Integration
  async setContextMenu(enable: boolean): Promise<void> {
      // Not supported in uTools
      return Promise.resolve();
  }

  async checkContextMenu(): Promise<boolean> {
      return false;
  }

  async isContextMenuSupported(): Promise<boolean> {
      return false;
  }
}
