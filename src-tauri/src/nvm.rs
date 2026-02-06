use tauri::command;
use std::env;
use std::fs;
use std::path::Path;
use serde::Serialize;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;
const CREATE_NEW_CONSOLE: u32 = 0x00000010;

#[derive(Serialize)]
pub struct NodeVersion {
    version: String,
    path: String,
    source: String, // "nvm" or "custom"
}

#[command]
pub async fn install_node(version: String) -> Result<String, String> {
    // Use cmd /C to wrap nvm command to satisfy "Terminal Only" requirement of nvm-windows
    // Use CREATE_NEW_CONSOLE to show the window so user can see progress and bypass terminal check
    // We add "& pause" so the window stays open regardless of success/failure
    // allowing the user to read the output/errors.
    let mut cmd = Command::new("cmd");
    let command_str = format!("nvm install {} & pause", version);
    cmd.arg("/C").arg(&command_str);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NEW_CONSOLE);

    // Use status() instead of output() to let stdout/stderr go to the new console window
    let status = cmd.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok("Installation completed".to_string())
    } else {
        Err("Installation failed".to_string())
    }
}

#[command]
pub async fn uninstall_node(version: String) -> Result<String, String> {
    let mut cmd = Command::new("cmd");
    let command_str = format!("nvm uninstall {} || pause", version);
    cmd.arg("/C").arg(&command_str);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NEW_CONSOLE);

    let status = cmd.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok("Uninstall completed".to_string())
    } else {
        Err("Uninstall failed".to_string())
    }
}

#[command]
pub async fn use_node(version: String) -> Result<String, String> {
    let mut cmd = Command::new("cmd");
    let command_str = format!("nvm use {} || pause", version);
    cmd.arg("/C").arg(&command_str);
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NEW_CONSOLE);

    let status = cmd.status().map_err(|e| e.to_string())?;

    if status.success() {
        Ok("Switch completed".to_string())
    } else {
        Err("Switch failed".to_string())
    }
}

#[command]
pub fn get_nvm_list() -> Result<Vec<NodeVersion>, String> {
    let nvm_home = env::var("NVM_HOME").map_err(|_| "NVM_HOME not set".to_string())?;
    let path = Path::new(&nvm_home);
    let mut versions = Vec::new();

    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.starts_with("v") {
                            versions.push(NodeVersion {
                                version: name.to_string(),
                                path: path.to_string_lossy().to_string(),
                                source: "nvm".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    versions.sort_by(|a, b| {
        let parse_version = |s: &str| -> Vec<u32> {
            s.trim_start_matches('v')
                .split('.')
                .map(|p| p.parse().unwrap_or(0))
                .collect()
        };
        let va = parse_version(&a.version);
        let vb = parse_version(&b.version);
        vb.cmp(&va) 
    });
    
    Ok(versions)
}

#[command]
pub fn get_node_version(path: String) -> Option<String> {
    let mut cmd = if path == "System Default" {
        #[cfg(target_os = "windows")]
        {
             // On Windows, 'node' might resolve to nvm's shim which is a symlink or batch file.
             // We want to know where it actually points to.
             // But 'node -v' just gives version.
             // If we want to find the path, we use 'where node'.
             Command::new("node")
        }
        #[cfg(not(target_os = "windows"))]
        Command::new("node")
    } else {
        // If path is a directory, append node.exe, otherwise use as is
        let p = Path::new(&path);
        let exe = if p.is_dir() {
            p.join("node.exe")
        } else {
            p.to_path_buf()
        };
        Command::new(exe)
    };
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    
    cmd.arg("-v");
    
    if let Ok(output) = cmd.output() {
        if output.status.success() {
            let output_str = String::from_utf8_lossy(&output.stdout);
            // Some node versions output "v14.17.0" others might output just "14.17.0"
            // We want to return the first line trimmed.
            if let Some(line) = output_str.lines().next() {
                let ver = line.trim();
                if ver.starts_with('v') {
                    return Some(ver.to_string());
                } else {
                    return Some(format!("v{}", ver));
                }
            }
        }
    }
    None
}

#[command]
pub fn get_system_node_path() -> String {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("where")
            .arg("node")
            .creation_flags(CREATE_NO_WINDOW)
            .output();
            
        if let Ok(output) = output {
             if output.status.success() {
                 let paths = String::from_utf8_lossy(&output.stdout);
                 // 'where' might return multiple paths, take the first one
                 if let Some(first) = paths.lines().next() {
                     return strip_executable_name(first.trim().to_string());
                 }
             }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("which")
            .arg("node")
            .output();
            
        if let Ok(output) = output {
             if output.status.success() {
                 let p_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                 return strip_executable_name(p_str);
             }
        }
    }
    
    // If 'where node' fails or returns nothing, maybe it's in a standard location?
    // Or maybe we just return "System Default" and let frontend handle it.
    "System Default".to_string()
}

fn strip_executable_name(path_str: String) -> String {
    let p = Path::new(&path_str);
    if let Some(file_name) = p.file_name().and_then(|n| n.to_str()) {
        if file_name.eq_ignore_ascii_case("node.exe") || file_name.eq_ignore_ascii_case("node") {
             if let Some(parent) = p.parent() {
                 return parent.to_string_lossy().to_string();
             }
        }
    }
    path_str
}
