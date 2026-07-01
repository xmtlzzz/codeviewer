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
            let _ = emit_scan_result(app.clone()).await;
        }
    });
}

pub async fn emit_scan_result(app: AppHandle) -> Result<(), ()> {
    let app_clone = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let state = app_clone.state::<crate::commands::AppState>();
        crate::commands::scan_state(&state)
    })
    .await
    .map_err(|_| ())?;

    let _ = app.emit("stats-updated", &result);
    Ok(())
}
