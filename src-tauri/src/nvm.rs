use tauri::command;
use std::env;
use std::fs;
use std::path::Path;
use serde::Serialize;

#[derive(Serialize)]
pub struct NodeVersion {
    version: String,
    path: String,
    source: String, // "nvm" or "custom"
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
