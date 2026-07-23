use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub fn spawn_scanner_task(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let _ = emit_scan_result(app.clone()).await;
            tokio::time::sleep(scan_interval(&app)).await;
        }
    });
}

fn scan_interval(app: &AppHandle) -> Duration {
    let state = app.state::<crate::commands::AppState>();
    let config = state.config.lock().unwrap();
    interval_duration(config.scan.interval_secs)
}

fn interval_duration(interval_secs: u64) -> Duration {
    Duration::from_secs(interval_secs)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interval_duration_uses_configured_seconds() {
        assert_eq!(interval_duration(5), Duration::from_secs(5));
        assert_eq!(interval_duration(120), Duration::from_secs(120));
    }
}
