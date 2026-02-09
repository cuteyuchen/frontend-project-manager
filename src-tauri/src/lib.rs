mod nvm;
mod project;
mod runner;
mod updater;

#[tauri::command]
fn read_config_file(filename: String) -> Result<String, String> {
    let mut path = std::env::current_exe().map_err(|e| e.to_string())?;
    path.pop();
    path.push(filename);
    
    if !path.exists() {
        return Ok("".to_string());
    }
    
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_config_file(filename: String, content: String) -> Result<(), String> {
    let mut path = std::env::current_exe().map_err(|e| e.to_string())?;
    path.pop();
    path.push(filename);
    
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(runner::ProcessState::new())
        .invoke_handler(tauri::generate_handler![
            nvm::get_nvm_list,
            nvm::get_node_version,
            nvm::get_system_node_path,
            nvm::install_node,
            nvm::uninstall_node,
            nvm::use_node,
            project::scan_project,
            runner::run_project_command,
            runner::stop_project_command,
            runner::open_in_editor,
            runner::open_folder,
            updater::install_update,
            read_config_file,
            write_config_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
