mod files;
mod links;
mod watch;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(watch::DeckWatcher::default())
        .invoke_handler(tauri::generate_handler![
            files::read_pptx_file,
            files::pptx_file_size,
            files::list_system_fonts,
            files::file_exists,
            files::write_report_file,
            links::check_links,
            watch::watch_deck
        ])
        .run(tauri::generate_context!())
        .expect("error while running SlideReady");
}
