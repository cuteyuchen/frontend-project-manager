export interface Project {
  id: string;
  name: string;
  path: string;
  type: 'node' | 'static';
  nodeVersion: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'cnpm';
  scripts: string[];
}

export interface Settings {
  editorPath: string; // e.g. "code" or absolute path
  defaultTerminal: 'cmd' | 'powershell' | 'git-bash';
  locale: 'zh' | 'en';
  themeMode: 'dark' | 'light' | 'auto';
  autoUpdate: boolean;
}

export interface NodeVersion {
  version: string;
  path: string;
  source: 'nvm' | 'custom' | 'system';
}
