use codeviewer_core::{aggregator, scanner};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub fn spawn_scanner_task(app: AppHandle) {
    // Read interval from config, then drop the lock immediately
    let interval_secs = {
        let state = app.state::<crate::commands::AppState>();
        let config = state.config.lock().unwrap();
        config.scan.interval_secs
    };

    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_secs(interval_secs));

        loop {
            ticker.tick().await;

            let app_clone = app.clone();
            let result = tauri::async_runtime::spawn_blocking(move || {
                let state = app_clone.state::<crate::commands::AppState>();
                let config = state.config.lock().unwrap().clone();
                let opts = scanner::ScanOptions {
                    author_email: if config.author_email.is_empty() {
                        None
                    } else {
                        Some(config.author_email.clone())
                    },
                    since_days: Some(config.scan.since_days),
                };
                let mut all = Vec::new();
                for r in &config.repos {
                    if let Ok(stats) = scanner::scan_repo(std::path::Path::new(&r.path), &opts) {
                        all.push(stats);
                    }
                }
                aggregator::aggregate(all)
            })
            .await;

            if let Ok(summary) = result {
                let _ = app.emit("stats-updated", &summary);
            }
        }
    });
}
