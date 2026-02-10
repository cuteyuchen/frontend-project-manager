use std::path::PathBuf;

#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;

#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::io::Write;
#[cfg(target_os = "linux")]
use std::os::unix::fs::PermissionsExt;

fn get_exe_path() -> Result<PathBuf, String> {
    std::env::current_exe().map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_context_menu(enable: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let exe_path = get_exe_path()?;
    let exe_str = exe_path.to_str().ok_or("Invalid path")?;
    
    let keys = vec![
        r"Software\Classes\Directory\shell\FrontendProjectManager",
        r"Software\Classes\Directory\Background\shell\FrontendProjectManager"
    ];
    
    for key_path in keys {
        if enable {
            let (key, _) = hkcu.create_subkey(key_path).map_err(|e| e.to_string())?;
            key.set_value("", &"Open in Project Manager").map_err(|e| e.to_string())?;
            key.set_value("Icon", &exe_str).map_err(|e| e.to_string())?;
            let (cmd_key, _) = key.create_subkey("command").map_err(|e| e.to_string())?;
            let cmd_str = format!("\"{}\" \"%V\"", exe_str);
            cmd_key.set_value("", &cmd_str).map_err(|e| e.to_string())?;
        } else {
            let _ = hkcu.delete_subkey_all(key_path);
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn check_context_menu() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key_path = r"Software\Classes\Directory\shell\FrontendProjectManager";
    hkcu.open_subkey(key_path).is_ok()
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn set_context_menu(enable: bool) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
    let applications_dir = std::path::Path::new(&home).join(".local/share/applications");
    let desktop_file_path = applications_dir.join("frontend-project-manager-context.desktop");

    if enable {
        if !applications_dir.exists() {
             fs::create_dir_all(&applications_dir).map_err(|e| e.to_string())?;
        }

        let exe_path = get_exe_path()?;
        let exe_str = exe_path.to_str().ok_or("Invalid path")?;
        
        // Basic .desktop file for "Open With" support
        // MimeType=inode/directory registers it for folders
        let content = format!(r#"[Desktop Entry]
Type=Application
Name=Open in Project Manager
Exec="{}" "%f"
Icon=folder-open
NoDisplay=true
MimeType=inode/directory;
"#, exe_str);

        let mut file = fs::File::create(&desktop_file_path).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        
        // Make executable
        let mut perms = fs::metadata(&desktop_file_path).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&desktop_file_path, perms).map_err(|e| e.to_string())?;
        
        // Try to update desktop database (optional)
        std::process::Command::new("update-desktop-database")
            .arg(&applications_dir)
            .output()
            .ok();
            
    } else {
        if desktop_file_path.exists() {
            fs::remove_file(&desktop_file_path).map_err(|e| e.to_string())?;
            
             std::process::Command::new("update-desktop-database")
            .arg(&applications_dir)
            .output()
            .ok();
        }
    }
    Ok(())
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn check_context_menu() -> bool {
     let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return false,
    };
    let path = std::path::Path::new(&home).join(".local/share/applications/frontend-project-manager-context.desktop");
    path.exists()
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
#[tauri::command]
pub fn set_context_menu(_enable: bool) -> Result<(), String> {
    Err("Not supported on this platform yet. Please use 'Open With' system configuration.".to_string())
}

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
#[tauri::command]
pub fn check_context_menu() -> bool {
    false
}

#[tauri::command]
pub fn is_context_menu_supported() -> bool {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        true
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        false
    }
}
