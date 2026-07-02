use codeviewer_core::{aggregator, config, models, scanner};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<config::Config>,
    pub config_path: PathBuf,
}

#[derive(Clone, serde::Serialize)]
pub struct ScanResult {
    pub summary: models::Summary,
    pub errors: Vec<String>,
}

fn repo_name_for(entry: &config::RepoEntry) -> String {
    entry.name.clone().unwrap_or_else(|| {
        std::path::Path::new(&entry.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string()
    })
}

pub fn scan_config(config: &config::Config) -> ScanResult {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() {
            None
        } else {
            Some(config.author_email.clone())
        },
        since_days: Some(config.scan.since_days),
    };
    let mut repos = Vec::new();
    let mut errors = Vec::new();

    for entry in &config.repos {
        match scanner::scan_repo(std::path::Path::new(&entry.path), &opts) {
            Ok(stats) => repos.push(models::RepoStat {
                repo_path: entry.path.clone(),
                repo_name: repo_name_for(entry),
                daily_stats: stats,
            }),
            Err(e) => errors.push(format!("{}: {}", entry.path, e)),
        }
    }

    ScanResult {
        summary: aggregator::aggregate(repos),
        errors,
    }
}

pub fn scan_state(state: &AppState) -> ScanResult {
    let config = state.config.lock().unwrap().clone();
    scan_config(&config)
}

#[tauri::command]
pub fn get_summary(state: State<'_, AppState>) -> models::Summary {
    scan_state(&state).summary
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> config::Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
pub fn scan_now(state: State<'_, AppState>) -> ScanResult {
    scan_state(&state)
}

/// Add a repo, persist config, return updated config.
#[tauri::command]
pub fn add_repo(
    state: State<'_, AppState>,
    path: String,
    name: Option<String>,
) -> Result<config::Config, String> {
    let mut guard = state.config.lock().unwrap();
    guard.add_repo(path, name);
    guard.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

/// Remove a repo by path, persist config, return updated config.
#[tauri::command]
pub fn remove_repo(
    state: State<'_, AppState>,
    path: String,
) -> Result<config::Config, String> {
    let mut guard = state.config.lock().unwrap();
    guard.remove_repo(&path);
    guard.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

/// Set author email, persist config, return updated config.
#[tauri::command]
pub fn set_author_email(
    state: State<'_, AppState>,
    email: String,
) -> Result<config::Config, String> {
    let mut guard = state.config.lock().unwrap();
    guard.set_author_email(email);
    guard.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn set_github_connection(
    state: State<'_, AppState>,
    username: String,
    token: String,
) -> Result<config::Config, String> {
    let mut guard = state.config.lock().unwrap();
    guard.set_github_connection(username, token);
    guard.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn clear_github_connection(state: State<'_, AppState>) -> Result<config::Config, String> {
    let mut guard = state.config.lock().unwrap();
    guard.clear_github_connection();
    guard.save(&state.config_path).map_err(|e| e.to_string())?;
    Ok(guard.clone())
}
