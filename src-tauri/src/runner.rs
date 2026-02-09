use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

    // Setup Log File
    let log_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
    if !log_dir.exists() {
        fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let log_file_path = log_dir.join(format!("{}_{}.log", id, timestamp));

    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path)
        .map_err(|e| e.to_string())?;

    let log_file = Arc::new(Mutex::new(log_file));

    // Construct full command and environment
    let full_cmd_str: String;
    let mut command_builder: Command;

    #[cfg(target_os = "windows")]
    {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = if !node_path.is_empty() {
            format!("{};{}", node_path, current_path)
        } else {
            current_path
        };

        // Try to resolve absolute path to package manager if node_path is provided
        let pm_cmd = if !node_path.is_empty() {
            let node_dir = std::path::Path::new(&node_path);
            let npm_cli_js = node_dir
                .join("node_modules")
                .join("npm")
                .join("bin")
                .join("npm-cli.js");

            if npm_cli_js.exists() {
                format!(
                    "\"{}\" \"{}\"",
                    std::path::Path::new(&node_path)
                        .join("node.exe")
                        .to_string_lossy(),
                    npm_cli_js.to_string_lossy()
                )
            } else {
                let pm_path_cmd = node_dir.join(format!("{}.cmd", package_manager));
                if pm_path_cmd.exists() {
                    format!("\"{}\"", pm_path_cmd.to_string_lossy())
                } else {
                    package_manager.clone()
                }
            }
        } else {
            if package_manager == "npm" || package_manager == "pnpm" || package_manager == "yarn" {
                format!("{}.cmd", package_manager)
            } else {
                package_manager.clone()
            }
        };

        let node_executable = if !node_path.is_empty() {
            let p = std::path::Path::new(&node_path).join("node.exe");
            format!("\"{}\"", p.to_string_lossy())
        } else {
            "node".to_string()
        };

        full_cmd_str = format!("{} -v && {} run {}", node_executable, pm_cmd, script);
        
        command_builder = Command::new("cmd");
        command_builder
            .raw_arg(format!(" /C \"{}\"", full_cmd_str))
            .env("PATH", new_path)
            .env_remove("SASS_BINARY_PATH")
            .creation_flags(CREATE_NO_WINDOW);
    }

    #[cfg(not(target_os = "windows"))]
    {
        let current_path = std::env::var("PATH").unwrap_or_default();
        let new_path = if !node_path.is_empty() {
            format!("{}:{}", node_path, current_path)
        } else {
            current_path
        };

        let pm_cmd = if !node_path.is_empty() {
            let node_dir = std::path::Path::new(&node_path);
            // Check for node_modules/npm/bin/npm-cli.js pattern (common in nvm installs)
            // Note: on Unix nvm, sometimes it's lib/node_modules/npm/bin/npm-cli.js
            // But if node_path is the bin dir, we might need to go up.
            // Let's assume standard nvm structure:
            // bin/node
            // lib/node_modules/npm/bin/npm-cli.js
            
            let npm_cli_js_bin = node_dir
                .join("node_modules")
                .join("npm")
                .join("bin")
                .join("npm-cli.js");
                
            let npm_cli_js_lib = node_dir
                .parent() // up from bin
                .map(|p| p.join("lib").join("node_modules").join("npm").join("bin").join("npm-cli.js"))
                .unwrap_or_else(|| std::path::PathBuf::from(""));

            if npm_cli_js_bin.exists() {
                 format!(
                    "\"{}\" \"{}\"",
                    node_dir.join("node").to_string_lossy(),
                    npm_cli_js_bin.to_string_lossy()
                )
            } else if npm_cli_js_lib.exists() {
                 format!(
                    "\"{}\" \"{}\"",
                    node_dir.join("node").to_string_lossy(),
                    npm_cli_js_lib.to_string_lossy()
                )
            } else {
                package_manager.clone()
            }
        } else {
            package_manager.clone()
        };

        let node_executable = if !node_path.is_empty() {
            let p = std::path::Path::new(&node_path).join("node");
            format!("\"{}\"", p.to_string_lossy())
        } else {
            "node".to_string()
        };

        full_cmd_str = format!("{} -v && {} run {}", node_executable, pm_cmd, script);

        command_builder = Command::new("sh");
        command_builder
            .arg("-c")
            .arg(&full_cmd_str)
            .env("PATH", new_path);
    }

    // Common Env Vars
    // Check if Node version < 17 (legacy provider check)
    let use_legacy_provider = !node_path.contains("v14.")
        && !node_path.contains("v16.")
        && !node_path.contains("v12.")
        && !node_path.contains("v10.");

    if use_legacy_provider {
        command_builder.env("NODE_OPTIONS", "--openssl-legacy-provider");
    } else {
        command_builder.env_remove("NODE_OPTIONS");
    }

    command_builder
        .current_dir(&path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Emit initial log
    let _ = app.emit(
        "project-output",
        serde_json::json!({
            "id": id,
            "type": "stdout",
            "data": format!("Executing: {}", full_cmd_str)
        }),
    );

    if let Ok(mut file) = log_file.lock() {
        let _ = writeln!(file, "Executing: {}", full_cmd_str);
    }

    let mut child = command_builder.spawn().map_err(|e| e.to_string())?;
    let pid = child.id();

    processes_lock.insert(id.clone(), pid);
    drop(processes_lock);

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let id_clone1 = id.clone();
    let app_clone1 = app.clone();
    let log_file1 = log_file.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        while let Ok(n) = reader.read_until(b'\n', &mut buf) {
            if n == 0 { break; }
            let line = String::from_utf8_lossy(&buf);
            let line_str = line.trim_end();

            let _ = app_clone1.emit(
                "project-output",
                serde_json::json!({
                    "id": id_clone1,
                    "type": "stdout",
                    "data": line_str
                }),
            );

            if let Ok(mut file) = log_file1.lock() {
                let _ = writeln!(file, "{}", line_str);
            }
            buf.clear();
        }
    });

    let id_clone2 = id.clone();
    let app_clone2 = app.clone();
    let log_file2 = log_file.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buf = Vec::new();
        while let Ok(n) = reader.read_until(b'\n', &mut buf) {
            if n == 0 { break; }
            let line = String::from_utf8_lossy(&buf);
            let line_str = line.trim_end();

            let _ = app_clone2.emit(
                "project-output",
                serde_json::json!({
                    "id": id_clone2,
                    "type": "stderr",
                    "data": line_str
                }),
            );

            if let Ok(mut file) = log_file2.lock() {
                let _ = writeln!(file, "ERR: {}", line_str);
            }
            buf.clear();
        }
    });

    let id_clone3 = id.clone();
    let app_clone3 = app.clone();
    let processes_clone = state.processes.clone();
    thread::spawn(move || {
        let _ = child.wait();
        if let Ok(mut lock) = processes_clone.lock() {
            lock.remove(&id_clone3);
        }
        let _ = app_clone3.emit(
            "project-exit",
            serde_json::json!({ "id": id_clone3 }),
        );
    });

    Ok(())
}

#[tauri::command]
pub fn stop_project_command(state: State<'_, ProcessState>, id: String) -> Result<(), String> {
    let processes = state.processes.clone();
    let lock = processes.lock().map_err(|e| e.to_string())?;

    if let Some(pid) = lock.get(&id) {
        #[cfg(target_os = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/F", "/T"])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = Command::new("kill")
                .arg(pid.to_string())
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_editor(path: String, editor: String) -> Result<(), String> {
    let editor = editor.trim().trim_matches('"');
    let editor_cmd = if editor.is_empty() { "code" } else { editor };

    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .args(&["/C", "start", "", editor_cmd, &path])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .args(&["-a", editor_cmd, &path])
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new(editor_cmd)
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    Command::new("cmd")
        .args(&["/C", "start", "", &url])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    Command::new("xdg-open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}
