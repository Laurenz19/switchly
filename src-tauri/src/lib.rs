mod commands;
mod git;
mod github;
mod model;
mod proc;
mod ssh;
mod store;
mod tray;

use std::sync::Mutex;
use tauri::{Manager, WindowEvent};

// Autostart launches with this flag: start in the tray, no window.
const HIDDEN_FLAG: &str = "--hidden";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch (e.g. from the Start menu) opens the running instance.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| tray::show_main(app)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![HIDDEN_FLAG]),
        ))
        .setup(|app| {
            let handle = app.handle();
            let store = store::Store::load(&handle.path().app_config_dir()?, handle.path().home_dir()?);
            let state = commands::build_state(&store);
            app.manage(Mutex::new(store));
            tray::create(handle, &state)?;
            if !std::env::args().any(|a| a == HIDDEN_FLAG) {
                tray::show_main(handle);
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Closing the main window keeps Switchly in the tray; quit is in
            // the tray menu.
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Focused(false) if window.label() == "popup" => {
                let _ = window.hide();
                tray::note_popup_hidden();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_state,
            commands::save_account,
            commands::delete_account,
            commands::set_rules,
            commands::switch_global,
            commands::generate_ssh_key,
            commands::set_ssh_key,
            commands::public_key,
            commands::test_ssh,
            commands::gcm_accounts,
            commands::gcm_login,
            commands::diagnose_repo,
            commands::open_main,
            commands::hide_popup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Switchly");
}
