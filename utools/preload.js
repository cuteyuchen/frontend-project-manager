const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

// Helper to run command and get output
function runCmd(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout.trim());
        });
    });
}

const processes = new Map();
let outputCallback = null;
let exitCallback = null;

// Cleanup on exit
utools.onPluginOut(() => {
    for (const [id, child] of processes) {
        try {
            child.kill();
        } catch (e) {}
    }
    processes.clear();
});

window.services = {
    getNvmList: async () => {
        // Windows
        if (process.platform === 'win32') {
            const nvmHome = process.env.NVM_HOME;
            if (!nvmHome) return [];
            
            try {
                const dirs = fs.readdirSync(nvmHome);
                const versions = [];
                
                for (const dir of dirs) {
                    if (dir.startsWith('v')) {
                        versions.push({
                            version: dir,
                            path: path.join(nvmHome, dir),
                            source: 'nvm'
                        });
                    }
                }
                return versions;
            } catch (e) {
                console.error(e);
                return [];
            }
        } 
        // macOS / Linux
        else {
            const home = process.env.HOME;
            const nvmDir = process.env.NVM_DIR || path.join(home, '.nvm');
            const versionsDir = path.join(nvmDir, 'versions', 'node');
            
            if (!fs.existsSync(versionsDir)) return [];
            
            try {
                const dirs = fs.readdirSync(versionsDir);
                const versions = [];
                
                for (const dir of dirs) {
                    if (dir.startsWith('v')) {
                        versions.push({
                            version: dir,
                            path: path.join(versionsDir, dir),
                            source: 'nvm'
                        });
                    }
                }
                return versions;
            } catch (e) {
                console.error(e);
                return [];
            }
        }
    },

    getSystemNodePath: async () => {
        try {
            return await runCmd('node -e "console.log(process.execPath)"');
        } catch (e) {
            return 'System Default';
        }
    },
    
    getNodeVersion: async (nodePath) => {
        try {
             const cmd = nodePath ? `"${nodePath}" -v` : 'node -v';
             return await runCmd(cmd);
        } catch (e) {
            return '';
        }
    },

    installNode: async (version) => {
        return new Promise((resolve, reject) => {
            if (process.platform === 'win32') {
                // Use PowerShell to start a new elevated window that runs nvm install
                // /c executes and terminates, but we add pause so user can see the result
                // Start-Process -Wait ensures we wait for that window to close
                const psCommand = `Start-Process cmd -ArgumentList '/c nvm install ${version} & pause' -Verb RunAs -Wait`;
                exec(`powershell -Command "${psCommand}"`, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    // Verify installation
                    const nvmHome = process.env.NVM_HOME;
                    if (nvmHome) {
                        const versionPath = path.join(nvmHome, version);
                        if (fs.existsSync(versionPath)) {
                            resolve("Success");
                        } else {
                            reject(new Error("Installation failed or cancelled"));
                        }
                    } else {
                        resolve("Done (Verification skipped)");
                    }
                });
            } else if (process.platform === 'darwin') {
                // macOS: Use AppleScript to open Terminal
                const script = `source ~/.nvm/nvm.sh && nvm install ${version}`;
                const appleScript = `tell application "Terminal" to do script "${script}"`;
                exec(`osascript -e '${appleScript}'`, (error) => {
                    if (error) reject(error);
                    else resolve("Started in Terminal");
                });
            } else {
                // Linux: Try common terminal emulators or fallback to background
                const script = `source ~/.nvm/nvm.sh && nvm install ${version} && read -p "Press enter to close"`;
                const terminals = [
                    { cmd: 'gnome-terminal', args: ['--', 'bash', '-c', script] },
                    { cmd: 'x-terminal-emulator', args: ['-e', `bash -c "${script}"`] },
                    { cmd: 'konsole', args: ['-e', 'bash', '-c', script] },
                    { cmd: 'xfce4-terminal', args: ['-e', `bash -c "${script}"`] },
                    { cmd: 'xterm', args: ['-e', `bash -c "${script}"`] }
                ];

                let started = false;
                for (const t of terminals) {
                    try {
                        spawn(t.cmd, t.args, { detached: true, stdio: 'ignore' });
                        started = true;
                        break;
                    } catch (e) {}
                }

                if (started) {
                    resolve("Started in Terminal");
                } else {
                    // Fallback: run in background and capture output
                    exec(`bash -c "source ~/.nvm/nvm.sh && nvm install ${version}"`, (error, stdout, stderr) => {
                         if (error) reject(new Error(stderr || error.message));
                         else resolve("Success");
                    });
                }
            }
        });
    },
    
    uninstallNode: async (version) => {
        return new Promise((resolve, reject) => {
            if (process.platform === 'win32') {
                const psCommand = `Start-Process cmd -ArgumentList '/c nvm uninstall ${version} & pause' -Verb RunAs -Wait`;
                exec(`powershell -Command "${psCommand}"`, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    
                    // Verify uninstallation
                    const nvmHome = process.env.NVM_HOME;
                    if (nvmHome) {
                        const versionPath = path.join(nvmHome, version);
                        if (!fs.existsSync(versionPath)) {
                            resolve("Success");
                        } else {
                            reject(new Error("Uninstallation failed or cancelled"));
                        }
                    } else {
                        resolve("Done");
                    }
                });
            } else if (process.platform === 'darwin') {
                const script = `source ~/.nvm/nvm.sh && nvm uninstall ${version}`;
                const appleScript = `tell application "Terminal" to do script "${script}"`;
                exec(`osascript -e '${appleScript}'`, (error) => {
                    if (error) reject(error);
                    else resolve("Started in Terminal");
                });
            } else {
                // Linux
                 exec(`bash -c "source ~/.nvm/nvm.sh && nvm uninstall ${version}"`, (error, stdout, stderr) => {
                     if (error) reject(new Error(stderr || error.message));
                     else resolve("Success");
                 });
            }
        });
    },
    
    useNode: async (version) => {
        return new Promise((resolve, reject) => {
            if (process.platform === 'win32') {
                const psCommand = `Start-Process cmd -ArgumentList '/c nvm use ${version} & pause' -Verb RunAs -Wait`;
                exec(`powershell -Command "${psCommand}"`, (error) => {
                    if (error) reject(error);
                    else resolve("Done");
                });
            } else if (process.platform === 'darwin') {
                 const script = `source ~/.nvm/nvm.sh && nvm use ${version}`;
                 const appleScript = `tell application "Terminal" to do script "${script}"`;
                 exec(`osascript -e '${appleScript}'`, (error) => {
                     if (error) reject(error);
                     else resolve("Done");
                 });
            } else {
                 // Linux: nvm use affects current shell only, usually useless for future commands
                 // But we can run it to set default if alias default is used
                 exec(`bash -c "source ~/.nvm/nvm.sh && nvm alias default ${version}"`, (error) => {
                     if (error) reject(error);
                     else resolve("Done (Set as default)");
                 });
            }
        });
    },

    scanProject: async (projectPath) => {
        try {
            const pkgPath = path.join(projectPath, 'package.json');
            if (!fs.existsSync(pkgPath)) throw new Error('package.json not found');
            
            const content = fs.readFileSync(pkgPath, 'utf-8');
            const pkg = JSON.parse(content);
            
            return {
                name: pkg.name || path.basename(projectPath),
                scripts: Object.keys(pkg.scripts || {}),
                path: projectPath
            };
        } catch (e) {
            throw e;
        }
    },

    runProjectCommand: async (id, projectPath, script, packageManager, nodePath) => {
        if (processes.has(id)) throw new Error('Already running');

        // Construct command to run in shell
        // We need to set PATH to include the selected node version
        // And then run the package manager command
        let cmdStr = '';
        
        // Handle Windows environment variables for the session
        if (process.platform === 'win32') {
            // If nodePath is provided, prepend it to PATH
            if (nodePath) {
                // Ensure we have the directory path, not the executable path
                let nodeDir = nodePath;
                try {
                    // If it's a file (e.g. node.exe), get its directory
                    if (fs.statSync(nodePath).isFile()) {
                        nodeDir = path.dirname(nodePath);
                    }
                } catch (e) {
                    // If check fails, assume it is a directory (standard NVM behavior)
                }
                
                cmdStr += `set "PATH=${nodeDir};%PATH%" && `;
            }
            
            // Append the actual command
            cmdStr += `${packageManager} run ${script}`;
        } else {
            // Unix/Linux/macOS
            if (nodePath) {
                 let nodeDir = nodePath;
                 try {
                     // On Unix, nodePath is usually .../bin/node
                     // We need the bin directory
                     if (fs.statSync(nodePath).isFile()) {
                         nodeDir = path.dirname(nodePath);
                     } else {
                         // If it's a directory (e.g. version root), append /bin
                         // Check if bin exists
                         if (fs.existsSync(path.join(nodePath, 'bin'))) {
                             nodeDir = path.join(nodePath, 'bin');
                         }
                     }
                 } catch (e) {}
                 
                 cmdStr += `export PATH="${nodeDir}:$PATH" && `;
            }
            cmdStr += `${packageManager} run ${script}`;
        }

        console.log('[Runner] Executing:', cmdStr);

        const child = spawn(cmdStr, [], {
            cwd: projectPath,
            shell: true,
            env: process.env // Inherit system env
        });
        
        processes.set(id, child);
        
        child.stdout.on('data', (data) => {
            if (outputCallback) outputCallback({ id, data: data.toString() });
        });
        
        child.stderr.on('data', (data) => {
            if (outputCallback) outputCallback({ id, data: data.toString() });
        });
        
        child.on('exit', () => {
            processes.delete(id);
            if (exitCallback) exitCallback({ id });
        });
    },

    stopProjectCommand: async (id) => {
        const child = processes.get(id);
        if (child) {
            // Simple kill, might need tree-kill for robust process termination on Windows
            child.kill(); 
            processes.delete(id);
        }
    },

    onProjectOutput: async (cb) => {
        outputCallback = cb;
        return () => { outputCallback = null; };
    },
    
    onProjectExit: async (cb) => {
        exitCallback = cb;
        return () => { exitCallback = null; };
    },

    readConfigFile: async (filename) => {
        // Use userData path
        const userPath = utools.getPath('userData');
        const filePath = path.join(userPath, filename);
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf-8');
        }
        return "";
    },
    
    writeConfigFile: async (filename, content) => {
        const userPath = utools.getPath('userData');
        const filePath = path.join(userPath, filename);
        fs.writeFileSync(filePath, content, 'utf-8');
    },

    readTextFile: async (path) => {
        return fs.readFileSync(path, 'utf-8');
    },

    writeTextFile: async (path, content) => {
        fs.writeFileSync(path, content, 'utf-8');
    },
    
    openDialog: async (options) => {
        const electronOptions = {
            properties: []
        };
        if (options?.directory) {
            electronOptions.properties.push('openDirectory');
        } else {
            electronOptions.properties.push('openFile');
        }
        if (options?.multiple) {
            electronOptions.properties.push('multiSelections');
        }
        if (options?.defaultPath) {
            electronOptions.defaultPath = options.defaultPath;
        }
        if (options?.filters) {
            electronOptions.filters = options.filters;
        }

        const result = utools.showOpenDialog(electronOptions);
        if (!result) return null;
        if (options?.multiple) return result;
        return result[0];
    },
    
    saveDialog: async (options) => {
        return utools.showSaveDialog(options);
    },
    
    openUrl: async (url) => {
        utools.shellOpenExternal(url);
    },
    
    openFolder: async (path) => {
        utools.shellOpenPath(path);
    },
    
    openInEditor: async (path, editor = 'code') => {
        spawn(editor, [path], { shell: true });
    },
    
    getAppVersion: async () => {
        return "0.1.7";
    },
    
    installUpdate: async (url) => {
        utools.shellOpenExternal(url);
    },
    
    onDownloadProgress: async (cb) => {
        return () => {};
    },
    
    // Window controls
    windowMinimize: async () => {
        utools.hideMainWindow();
    },
    windowMaximize: async () => {
        // uTools usually doesn't support maximizing in the traditional sense like an app window
        // But we can keep it empty or try to do nothing
    },
    windowUnmaximize: async () => {},
    windowClose: async () => { utools.outPlugin(); },
    windowIsMaximized: async () => true,
    windowSetAlwaysOnTop: async () => {},
    onWindowResize: async () => () => {}
};
