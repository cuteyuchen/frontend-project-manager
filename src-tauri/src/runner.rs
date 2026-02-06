use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, State};

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
        let npm_cli_js = node_dir
            .join("node_modules")
            .join("npm")
            .join("bin")
            .join("npm-cli.js");

        if npm_cli_js.exists() {
            // If we found npm-cli.js, we return it.
            format!(
                "\"{}\" \"{}\"",
                std::path::Path::new(&node_path)
                    .join("node.exe")
                    .to_string_lossy(),
                npm_cli_js.to_string_lossy()
            )
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
        // On Windows, if we are just running "npm", we should try "npm.cmd" to be safe
        // because cmd /C npm sometimes fails if npm is not in a very specific way in PATH
        if cfg!(windows)
            && (package_manager == "npm" || package_manager == "pnpm" || package_manager == "yarn")
        {
            format!("{}.cmd", package_manager)
        } else {
            package_manager.clone()
        }
    };

    // Determine node executable for version check
    // Ensure we wrap it in quotes if it contains spaces
    let node_executable = if !node_path.is_empty() {
        let p = std::path::Path::new(&node_path).join("node.exe");
        format!("\"{}\"", p.to_string_lossy())
    } else {
        "node".to_string()
    };

    let mut cmd = Command::new("cmd");

    // Log the command for debugging
    // We chain "node -v" to print the version first
    // Note: We need to use quotes carefully for cmd /C
    let full_cmd = format!("{} -v && {} run {}", node_executable, pm_cmd, script);

    let _ = app.emit(
        "project-output",
        serde_json::json!({
            "id": id,
            "type": "stdout",
            "data": format!("Executing: {}", full_cmd)
        }),
    );

    // Write start log
    if let Ok(mut file) = log_file.lock() {
        let _ = writeln!(file, "Executing: {}", full_cmd);
    }

    // Fix for "The filename, directory name, or volume label syntax is incorrect."
    // or "'...'" is not recognized as an internal or external command.
    //
    // Rust's `Command::args` automatically escapes arguments (e.g. adding backslashes before quotes).
    // `cmd.exe /C` expects a command string where quotes are semantic delimiters, not escaped characters.
    // If Rust passes `\"D:\path\node.exe\"`, `cmd` sees a file named `\"D:\path\node.exe\"` (literal quotes), which fails.
    //
    // To fix this, we use `raw_arg` to pass the command string exactly as we want `cmd` to see it.
    // We also wrap the entire command in outer quotes ` "..." ` to satisfy `cmd /C`'s quote stripping rules.
    // Pattern: cmd /C "command"

    // Check if Node version < 17 (e.g. 14, 16)
    // --openssl-legacy-provider is only for Node 17+ (specifically 17-18+ usually)
    // If we are using Node 14, we MUST NOT set this env var.
    // Since we don't parse version here easily, let's just NOT set it by default?
    // Or set it only if we know it's needed?
    // Actually, many legacy Vue/React projects need this on Node 18+.
    // But if the user selected Node 14, setting it causes a crash.

    // We should probably check the node version string if possible, but we only have `node_path`.
    // We can assume if the user went through the trouble of selecting a specific node version (which is passed as `node_path`),
    // they probably picked a compatible one.
    // If `node_path` contains "v14" or "v16" or "v12", we should definitely NOT set it.
    // Or simpler: Just don't set it globally. Let the user configure it in their package.json or we can add a toggle.
    // But for "smart" defaults:
    // If we detect "v14" in the path, skip it.

    let use_legacy_provider = !node_path.contains("v14.")
        && !node_path.contains("v16.")
        && !node_path.contains("v12.")
        && !node_path.contains("v10.");

    let mut command_builder = cmd
        .raw_arg(format!(" /C \"{}\"", full_cmd))
        .current_dir(&path)
        .env("PATH", new_path)
        .env_remove("SASS_BINARY_PATH");

    if use_legacy_provider {
        command_builder = command_builder.env("NODE_OPTIONS", "--openssl-legacy-provider");
    } else {
        command_builder = command_builder.env_remove("NODE_OPTIONS");
    }

    command_builder
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
    let log_file1 = log_file.clone();
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = Vec::new();
        while let Ok(n) = reader.read_until(b'\n', &mut buf) {
            if n == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&buf);
            let line_str = line.trim_end();

            // Emit to UI
            let _ = app_clone1.emit(
                "project-output",
                serde_json::json!({
                    "id": id_clone1,
                    "type": "stdout",
                    "data": line_str
                }),
            );

            // Write to file
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
            if n == 0 {
                break;
            }
            let line = String::from_utf8_lossy(&buf);
            let line_str = line.trim_end();

            // Emit to UI
            let _ = app_clone2.emit(
                "project-output",
                serde_json::json!({
                    "id": id_clone2,
                    "type": "stderr",
                    "data": line_str
                }),
            );

            // Write to file
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

        // Remove from state
        if let Ok(mut lock) = processes_clone.lock() {
            lock.remove(&id_clone3);
        }

        let _ = app_clone3.emit(
            "project-exit",
            serde_json::json!({
                "id": id_clone3
            }),
        );
    });

    Ok(())
}

#[tauri::command]
pub fn stop_project_command(state: State<'_, ProcessState>, id: String) -> Result<(), String> {
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
    // Clean editor path (remove surrounding quotes if user added them)
    let editor = editor.trim().trim_matches('"');
    let editor_cmd = if editor.is_empty() { "code" } else { editor };

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
