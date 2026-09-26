// The tray icon: left click toggles the popup window above it, right click
// opens a menu that switches the global account.
use crate::model::AppState;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};
use tauri_plugin_positioner::{Position, WindowExt};

const TRAY_ID: &str = "switchly";

// When the popup is open, clicking the tray icon first blurs the popup (which
// hides it) and then delivers the click, which would reopen it at once.
static POPUP_HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);

pub fn note_popup_hidden() {
    if let Ok(mut t) = POPUP_HIDDEN_AT.lock() {
        *t = Some(Instant::now());
    }
}

pub fn hide_popup(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("popup") {
        let _ = w.hide();
        note_popup_hidden();
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_popup(app: &AppHandle) {
    let Some(w) = app.get_webview_window("popup") else { return };
    if w.is_visible().unwrap_or(false) {
        hide_popup(app);
        return;
    }
    let just_hidden = POPUP_HIDDEN_AT
        .lock()
        .ok()
        .and_then(|t| *t)
        .is_some_and(|t| t.elapsed() < Duration::from_millis(300));
    if just_hidden {
        return;
    }
    // Above the icon: Windows' taskbar is at the bottom.
    let _ = w.move_window(Position::TrayCenter);
    let _ = w.show();
    let _ = w.set_focus();
}

fn active_label(state: &AppState) -> String {
    let account = state.global.account_id.as_deref().and_then(|id| state.accounts.iter().find(|a| a.id == id));
    match (account, &state.global.email) {
        (Some(a), _) => a.label.clone(),
        (None, Some(email)) => email.clone(),
        (None, None) => "not set".into(),
    }
}

fn build_menu(app: &AppHandle, state: &AppState) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    let active = state.global.account_id.as_deref();
    menu.append(&MenuItem::with_id(app, "header", format!("Global: {}", active_label(state)), false, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    for account in &state.accounts {
        let id = format!("switch:{}", account.id);
        let checked = active == Some(account.id.as_str());
        menu.append(&CheckMenuItem::with_id(app, id, &account.label, true, checked, None::<&str>)?)?;
    }
    if !state.accounts.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(app, "open", "Open Switchly", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit Switchly", true, None::<&str>)?)?;
    Ok(menu)
}

fn tooltip(state: &AppState) -> String {
    format!("Switchly: {}", active_label(state))
}

pub fn create(app: &AppHandle, state: &AppState) -> tauri::Result<()> {
    let icon = app.default_window_icon().cloned().expect("the app icon is bundled");
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip(tooltip(state))
        .menu(&build_menu(app, state)?)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            other => {
                if let Some(id) = other.strip_prefix("switch:") {
                    if let Err(e) = crate::commands::switch_to(app, id) {
                        eprintln!("Switch failed: {e}");
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                toggle_popup(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

pub fn refresh(app: &AppHandle, state: &AppState) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = build_menu(app, state) {
            let _ = tray.set_menu(Some(menu));
        }
        let _ = tray.set_tooltip(Some(tooltip(state)));
    }
}
