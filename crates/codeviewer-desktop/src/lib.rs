use std::sync::Mutex;

mod commands;
mod scanner_task;
mod tray;

use commands::AppState;
use codeviewer_core::config::CloseBehavior;
use tauri::Manager;

pub fn run() {
    let config_path = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codeviewer")
        .join("config.toml");

    let config = codeviewer_core::config::Config::load(&config_path).unwrap_or_default();

    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(config),
            config_path,
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<AppState>();
                let behavior = state.config.lock().unwrap().close_behavior.clone();
                if behavior == CloseBehavior::Minimize {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            #[cfg(desktop)]
            {
                tray::create_tray(app.handle())?;
            }
            scanner_task::spawn_scanner_task(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_summary,
            commands::get_config,
            commands::scan_now,
            commands::add_repo,
            commands::remove_repo,
            commands::set_author_email,
        ])
        .run(tauri::generate_context!())
        .expect("error while running codeviewer application");
}
