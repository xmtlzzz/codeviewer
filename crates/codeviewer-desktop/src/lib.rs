use std::sync::Mutex;

mod commands;
mod scanner_task;
mod tray;

use commands::AppState;

pub fn run() {
    let config_path = dirs::config_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("codeviewer")
        .join("config.toml");

    let config = codeviewer_core::config::Config::load(&config_path).unwrap_or_default();

    tauri::Builder::default()
        .manage(AppState {
            config: Mutex::new(config),
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running codeviewer application");
}
