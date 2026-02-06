mod nvm;
mod project;
mod runner;

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
            runner::open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
