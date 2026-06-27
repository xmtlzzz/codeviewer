use codeviewer_core::{aggregator, config, models, scanner};
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub config: Mutex<config::Config>,
}

fn scan_all(config: &config::Config) -> (Vec<Vec<models::DailyStat>>, Vec<String>) {
    let opts = scanner::ScanOptions {
        author_email: if config.author_email.is_empty() {
            None
        } else {
            Some(config.author_email.clone())
        },
        since_days: Some(config.scan.since_days),
    };
    let mut all = Vec::new();
    let mut errors = Vec::new();
    for r in &config.repos {
        match scanner::scan_repo(std::path::Path::new(&r.path), &opts) {
            Ok(stats) => all.push(stats),
            Err(e) => errors.push(format!("{}: {}", r.path, e)),
        }
    }
    (all, errors)
}

#[tauri::command]
pub fn get_summary(state: State<'_, AppState>) -> models::Summary {
    let config = state.config.lock().unwrap().clone();
    let (all, _errors) = scan_all(&config);
    aggregator::aggregate(all)
}

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> config::Config {
    state.config.lock().unwrap().clone()
}

#[derive(serde::Serialize)]
pub struct ScanResult {
    pub summary: models::Summary,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn scan_now(state: State<'_, AppState>) -> ScanResult {
    let config = state.config.lock().unwrap().clone();
    let (all, errors) = scan_all(&config);
    let summary = aggregator::aggregate(all);
    ScanResult { summary, errors }
}
