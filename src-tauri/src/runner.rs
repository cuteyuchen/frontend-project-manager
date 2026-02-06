use tauri::{AppHandle, Emitter, State};
use std::collections::HashMap;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::io::{BufRead, BufReader};
use std::thread;
use std::os::windows::process::CommandExt;

pub struct ProcessState {
    pub processes: Arc<Mutex<HashMap<String, u32>>>,
}

impl ProcessState {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub fn run_project_command(
    app: AppHandle,
    state: State<'_, ProcessState>,
    id: String,
    path: String,
    script: String,
    package_manager: String,
    node_path: String, 
) -> Result<(), String> {
    let processes = state.processes.clone();
    let mut processes_lock = processes.lock().map_err(|e| e.to_string())?;
    
    if processes_lock.contains_key(&id) {
        return Err("Project is already running".to_string());
    }

    let current_path = std::env::var("PATH").unwrap_or_default();
    let new_path = if !node_path.is_empty() {
        format!("{};{}", node_path, current_path)
    } else {
        current_path
    };

    // Try to resolve absolute path to package manager if node_path is provided
    let pm_cmd = if !node_path.is_empty() {
        // First try to find npm-cli.js pattern (most robust for execution with specific node)
        // Check for node_modules/npm/bin/npm-cli.js in the node directory
        let node_dir = std::path::Path::new(&node_path);
        let npm_cli_js = node_dir.join("node_modules").join("npm").join("bin").join("npm-cli.js");
        
        if npm_cli_js.exists() {
             // If we found npm-cli.js, we return it. 
             // IMPORTANT: When running js file, we need to use "node npm-cli.js" pattern.
             // But here we are returning just the command string.
             // So we need to change how we construct the command below.
             format!("\"{}\" \"{}\"", std::path::Path::new(&node_path).join("node.exe").to_string_lossy(), npm_cli_js.to_string_lossy())
        } else {
            // Fallback to npm.cmd
            let pm_path_cmd = node_dir.join(format!("{}.cmd", package_manager));
            if pm_path_cmd.exists() {
                format!("\"{}\"", pm_path_cmd.to_string_lossy())
            } else {
                package_manager.clone()
            }
        }
    } else {
        package_manager.clone()
    };

    let mut cmd = Command::new("cmd");
    
    // If pm_cmd contains space (like "node.exe" "npm-cli.js"), we shouldn't quote it again as a single argument if we were passing it as arg0
    // But here we are passing it to cmd /C which takes a string.
    // If pm_cmd is complex command, we should be careful.
    
    // If we detected npm-cli.js pattern, pm_cmd is `"path/to/node" "path/to/npm-cli.js"`
    // Then `pm_cmd run script` becomes `"path/to/node" "path/to/npm-cli.js" run script`
    // This is valid for cmd /C.
    
    cmd.args(&["/C", &format!("{} run {}", pm_cmd, script)])
       .current_dir(&path)
       .env("PATH", new_path)
       .env("NODE_OPTIONS", "--openssl-legacy-provider")
       // Force node-sass to build/download for the current environment instead of relying on cached binary
       // Or better, tell it to download the binary for the specific node version
       // Actually the error "Unsupported runtime (127)" suggests it's trying to use a binding built for a different Node version.
       // Running `npm rebuild node-sass` usually fixes this.
       // But we can't easily run that automatically.
       // However, often this is caused because it can't find the binding for the *current* node version.
       // By setting SASS_BINARY_NAME to something platform specific but maybe not strict version, we might help?
       // No, the best fix for "Unsupported runtime" when switching node versions is to force a rebuild or re-download.
       // But we can't do that. 
       // WAIT: The user is using Node 22 (from previous logs) but the project seems to want something else?
       // Ah, `node-sass` v4.14.1 only supports up to Node 14. 
       // If the user selected Node 22 for this project, `node-sass` 4.x will definitely fail.
       // The user MUST select Node 14 for this project in our UI.
       // Assuming the user selected Node 14, but `node-sass` still complains.
       // If they selected Node 14, but the `node_modules` were installed using a different Node version (e.g. system Node 18), 
       // then `node-sass` binding is for Node 18. When we run with Node 14, it sees the Node 18 binding and complains.
       // 
       // We can try to set `SASS_BINARY_PATH` if we knew where it was, but we don't.
       // The only robust way is to tell the user to `npm rebuild node-sass` with the correct node version.
       // But maybe we can try to skip binding check? No.
       
       // Let's at least ensure we don't carry over conflicting env vars.
       .env_remove("SASS_BINARY_PATH") 
       .stdout(Stdio::piped())
       .stderr(Stdio::piped())
       .creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    let pid = child.id();
    
    processes_lock.insert(id.clone(), pid);
    drop(processes_lock); // Release lock

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let id_clone1 = id.clone();
    let app_clone1 = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone1.emit("project-output", serde_json::json!({
                    "id": id_clone1,
                    "type": "stdout",
                    "data": line
                }));
            }
        }
    });

    let id_clone2 = id.clone();
    let app_clone2 = app.clone();
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                 let _ = app_clone2.emit("project-output", serde_json::json!({
                    "id": id_clone2,
                    "type": "stderr",
                    "data": line
                }));
            }
        }
    });

    let id_clone3 = id.clone();
    let app_clone3 = app.clone();
    let processes_clone = state.processes.clone();
    thread::spawn(move || {
        let _ = child.wait();
        
        // Remove from state
        if let Ok(mut lock) = processes_clone.lock() {
            lock.remove(&id_clone3);
        }

        let _ = app_clone3.emit("project-exit", serde_json::json!({
            "id": id_clone3
        }));
    });

    Ok(())
}

#[tauri::command]
pub fn stop_project_command(
    state: State<'_, ProcessState>,
    id: String
) -> Result<(), String> {
    let processes = state.processes.clone();
    let lock = processes.lock().map_err(|e| e.to_string())?;
    
    if let Some(pid) = lock.get(&id) {
        let _ = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/F", "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    // Note: We don't remove from map here immediately, we let the wait() thread do it
    // Or we can remove it? If we remove it, the wait thread might try to remove it again (which is fine)
    // But if we remove it, we can't kill it again if taskkill fails? 
    // Actually taskkill is async spawn. 
    
    Ok(())
}

#[tauri::command]
pub fn open_in_editor(path: String, editor: String) -> Result<(), String> {
     let editor_cmd = if editor.is_empty() { "code" } else { &editor };
     Command::new("cmd")
        .args(&["/C", "start", "", editor_cmd, &path])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
     Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
