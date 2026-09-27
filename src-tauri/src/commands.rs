// The Tauri commands behind src/api.ts. Every change is saved to config.json,
// applied to git, then broadcast ("state-changed") to both windows and the tray.
use crate::model::{Account, AppState, GlobalIdentity, RepoFacts, Rule, SshTest};
use crate::store::Store;
use crate::{git, github, guard, ssh, tray};
use std::path::Path;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

pub type SharedStore = Mutex<Store>;

fn lock<'a>(store: &'a SharedStore) -> Result<MutexGuard<'a, Store>, String> {
    store.lock().map_err(|_| "Switchly's state is unavailable; restart the app.".to_string())
}

fn new_id() -> String {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{nanos:x}")
}

// SSH keys Switchly set up, normalized like git config values.
fn managed_keys(store: &Store) -> Vec<String> {
    store.config.accounts.iter().filter_map(|a| a.ssh_key_path.as_ref()).map(|k| to_slashes(k)).collect()
}

fn to_slashes(path: &str) -> String {
    path.replace('\\', "/")
}

fn find_account(store: &Store, id: &str) -> Result<Account, String> {
    store.config.accounts.iter().find(|a| a.id == id).cloned().ok_or_else(|| "That account no longer exists.".into())
}

fn global_account_id(store: &Store, email: Option<&str>) -> Option<String> {
    let email = email?;
    store.config.accounts.iter().find(|a| a.email.eq_ignore_ascii_case(email)).map(|a| a.id.clone())
}

// Read fresh from git each time, so changes made outside Switchly show up.
pub fn build_state(store: &Store) -> AppState {
    let (name, email) = git::global_identity().unwrap_or((None, None));
    let account_id = global_account_id(store, email.as_deref());
    let gh_available = github::gh_available();
    AppState {
        accounts: store.config.accounts.clone(),
        rules: store.config.rules.clone(),
        global: GlobalIdentity { name, email, account_id },
        gh_user: if gh_available { github::gh_active_user() } else { None },
        gh_available,
        guard: guard::is_enabled(&store.managed_dir),
    }
}

pub fn language(store: &Store) -> &str {
    store.config.language.as_deref().unwrap_or("en")
}

fn changed(app: &AppHandle, store: &Store) -> AppState {
    // Keep the guard's folder → email list in step with the rules.
    if let Err(e) = guard::write_rules(&store.managed_dir, &store.config) {
        eprintln!("{e}");
    }
    let state = build_state(store);
    tray::refresh(app, &state, language(store));
    let _ = app.emit("state-changed", &state);
    state
}

#[tauri::command]
pub fn get_state(store: State<'_, SharedStore>) -> Result<AppState, String> {
    Ok(build_state(&*lock(&store)?))
}

#[tauri::command]
pub fn save_account(app: AppHandle, store: State<'_, SharedStore>, account: Account) -> Result<Account, String> {
    let mut s = lock(&store)?;
    let mut account = Account {
        label: account.label.trim().to_string(),
        name: account.name.trim().to_string(),
        email: account.email.trim().to_string(),
        username: account.username.trim().to_string(),
        host: crate::hosts::by_id(&account.host).id.to_string(),
        ..account
    };
    if account.label.is_empty() || account.name.is_empty() || account.email.is_empty() {
        return Err("Label, name and email are required.".into());
    }
    // GitHub logins are case-insensitive, but Git Credential Manager finds a
    // stored login only by its exact spelling: "laurenz19" misses "Laurenz19"
    // and GCM asks to sign in again. Use the spelling GCM already has.
    // (Only GitHub: GCM can list its logins for GitHub alone.)
    if account.host == "github" {
        if let Some(known) = github::gcm_accounts()
            .unwrap_or_default()
            .into_iter()
            .find(|u| u.eq_ignore_ascii_case(&account.username))
        {
            account.username = known;
        }
    }
    if s.config.accounts.iter().any(|a| a.id != account.id && a.email.eq_ignore_ascii_case(&account.email)) {
        return Err(format!("Another account already uses {}.", account.email));
    }

    // If this account is the global identity, the global config follows the edit.
    let (_, global_email) = git::global_identity()?;
    let was_global = !account.id.is_empty() && global_account_id(&s, global_email.as_deref()).as_deref() == Some(&account.id);

    if account.id.is_empty() {
        account.id = new_id();
        s.config.accounts.push(account.clone());
    } else {
        let slot = s.config.accounts.iter_mut().find(|a| a.id == account.id).ok_or("That account no longer exists.")?;
        *slot = account.clone();
    }
    git::write_account_file(&s.managed_dir, &account)?;
    s.save()?;
    if was_global {
        git::switch_global(&account, &managed_keys(&s))?;
    }
    changed(&app, &s);
    Ok(account)
}

#[tauri::command]
pub fn delete_account(app: AppHandle, store: State<'_, SharedStore>, id: String) -> Result<(), String> {
    let mut s = lock(&store)?;
    s.config.accounts.retain(|a| a.id != id);
    s.config.rules.retain(|r| r.account_id != id);
    git::sync_rules(&s.managed_dir, &s.config.rules)?;
    git::remove_account_file(&s.managed_dir, &id);
    s.save()?;
    changed(&app, &s);
    Ok(())
}

#[tauri::command]
pub fn set_rules(app: AppHandle, store: State<'_, SharedStore>, rules: Vec<Rule>) -> Result<(), String> {
    let mut s = lock(&store)?;
    let mut seen = std::collections::HashSet::new();
    for rule in &rules {
        let folder = git::normalize_folder(&rule.folder);
        if folder == "/" {
            return Err("A rule needs a folder.".into());
        }
        if !seen.insert(folder.to_lowercase()) {
            return Err(format!("{folder} has more than one rule."));
        }
        // Make sure every file a rule points at exists before git includes it.
        git::write_account_file(&s.managed_dir, &find_account(&s, &rule.account_id)?)?;
    }
    let rules: Vec<Rule> =
        rules.into_iter().map(|r| Rule { folder: git::normalize_folder(&r.folder), account_id: r.account_id }).collect();
    git::sync_rules(&s.managed_dir, &rules)?;
    s.config.rules = rules;
    s.save()?;
    changed(&app, &s);
    Ok(())
}

// Shared by the command and the tray menu. Git always switches; the result is
// the GitHub login gh couldn't switch to because gh isn't signed in to it yet
// (gh keeps its own accounts), for the UI to offer setting it up.
pub fn switch_to(app: &AppHandle, id: &str) -> Result<Option<String>, String> {
    let store = app.state::<SharedStore>();
    let s = lock(&store)?;
    let account = find_account(&s, id)?;
    git::write_account_file(&s.managed_dir, &account)?;
    git::switch_global(&account, &managed_keys(&s))?;
    // gh only knows GitHub.
    let gh_missing = if account.host == "github" && !account.username.is_empty() && github::gh_available() {
        github::gh_switch(&account.username).is_err().then(|| account.username.clone())
    } else {
        None
    };
    changed(app, &s);
    Ok(gh_missing)
}

#[tauri::command]
pub fn switch_global(app: AppHandle, id: String) -> Result<Option<String>, String> {
    switch_to(&app, &id)
}

fn set_key(app: &AppHandle, s: &mut Store, id: &str, key: Option<String>) -> Result<(), String> {
    let (_, global_email) = git::global_identity()?;
    let was_global = global_account_id(s, global_email.as_deref()).as_deref() == Some(id);
    let slot = s.config.accounts.iter_mut().find(|a| a.id == id).ok_or("That account no longer exists.")?;
    slot.ssh_key_path = key.map(|k| k.replace('\\', "/"));
    let account = slot.clone();
    git::write_account_file(&s.managed_dir, &account)?;
    s.save()?;
    if was_global {
        git::switch_global(&account, &managed_keys(&s))?;
    }
    changed(app, s);
    Ok(())
}

// Creates a dedicated key for the account and returns its public half, to be
// pasted into GitHub.
#[tauri::command]
pub fn generate_ssh_key(app: AppHandle, store: State<'_, SharedStore>, id: String) -> Result<String, String> {
    let mut s = lock(&store)?;
    let account = find_account(&s, &id)?;
    let path = ssh::generate_key(&s.home, &id, &account.email)?;
    let path = path.to_string_lossy().to_string();
    set_key(&app, &mut s, &id, Some(path.clone()))?;
    ssh::public_key(&path)
}

// Uses an existing private key (e.g. ~/.ssh/id_ed25519), or none.
#[tauri::command]
pub fn set_ssh_key(app: AppHandle, store: State<'_, SharedStore>, id: String, path: Option<String>) -> Result<(), String> {
    if let Some(p) = &path {
        if !Path::new(p).is_file() {
            return Err(format!("{p} isn't a file."));
        }
        if p.ends_with(".pub") {
            return Err("Pick the private key (the file without .pub).".into());
        }
    }
    let mut s = lock(&store)?;
    set_key(&app, &mut s, &id, path)
}

#[tauri::command]
pub fn public_key(store: State<'_, SharedStore>, id: String) -> Result<Option<String>, String> {
    let s = lock(&store)?;
    match find_account(&s, &id)?.ssh_key_path {
        Some(path) => ssh::public_key(&path).map(Some),
        None => Ok(None),
    }
}

// Network call: the lock is released before connecting.
#[tauri::command]
pub async fn test_ssh(store: State<'_, SharedStore>, id: String) -> Result<SshTest, String> {
    let account = find_account(&*lock(&store)?, &id)?;
    let host = crate::hosts::by_id(&account.host);
    tauri::async_runtime::spawn_blocking(move || ssh::test_connection(host, account.ssh_key_path.as_deref()))
        .await
        .map_err(|e| e.to_string())?
}

// Whether Git Credential Manager holds this account's HTTPS login.
#[tauri::command]
pub async fn credential_status(store: State<'_, SharedStore>, id: String) -> Result<bool, String> {
    let account = find_account(&*lock(&store)?, &id)?;
    if account.username.is_empty() {
        return Ok(false);
    }
    let host = crate::hosts::by_id(&account.host);
    tauri::async_runtime::spawn_blocking(move || github::credential_status(host, &account.username))
        .await
        .map_err(|e| e.to_string())
}

// Opens GCM's sign-in window for the account's host and stores the login.
#[tauri::command]
pub async fn credential_login(store: State<'_, SharedStore>, id: String) -> Result<(), String> {
    let account = find_account(&*lock(&store)?, &id)?;
    if account.username.is_empty() {
        return Err("Set a username for this account first.".into());
    }
    let host = crate::hosts::by_id(&account.host);
    tauri::async_runtime::spawn_blocking(move || github::credential_login(host, &account.username))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gcm_accounts() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(github::gcm_accounts).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gcm_login() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(github::gcm_login).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn diagnose_repo(path: String) -> Result<RepoFacts, String> {
    tauri::async_runtime::spawn_blocking(move || git::repo_facts(Path::new(&path)))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn set_guard(app: AppHandle, store: State<'_, SharedStore>, on: bool) -> Result<(), String> {
    let s = lock(&store)?;
    if on {
        guard::enable(&s.managed_dir, &s.config)?;
    } else {
        guard::disable(&s.managed_dir)?;
    }
    changed(&app, &s);
    Ok(())
}

#[tauri::command]
pub fn set_language(app: AppHandle, store: State<'_, SharedStore>, lang: String) -> Result<(), String> {
    if !tray::LANGUAGES.contains(&lang.as_str()) {
        return Err(format!("Unsupported language: {lang}"));
    }
    let mut s = lock(&store)?;
    if s.config.language.as_deref() != Some(lang.as_str()) {
        s.config.language = Some(lang);
        s.save()?;
    }
    let state = build_state(&s);
    tray::refresh(&app, &state, language(&s));
    Ok(())
}

#[derive(Clone, serde::Serialize)]
struct GhCode {
    code: String,
    url: &'static str,
}

// Signs gh in to `user` inside Switchly: the one-time code is sent to the UI
// ("gh-login-code"), which shows it and opens GitHub's page. Resolves once the
// user confirmed on GitHub, and checks gh really signed in to `user`.
#[tauri::command]
pub async fn gh_login(app: AppHandle, user: String) -> Result<(), String> {
    let emitter = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        github::gh_login_device(|code| {
            let _ = emitter.emit("gh-login-code", GhCode { code: code.to_string(), url: github::GH_DEVICE_URL });
        })
    })
    .await
    .map_err(|e| e.to_string())??;

    let active = github::gh_active_user().unwrap_or_default();
    if !active.eq_ignore_ascii_case(&user) {
        return Err(format!(
            "gh signed in as {active}, not {user}: the browser was signed in to another GitHub account. Sign in there as {user}, then try again."
        ));
    }
    let store = app.state::<SharedStore>();
    let s = lock(&store)?;
    changed(&app, &s);
    Ok(())
}

#[tauri::command]
pub async fn requirements() -> Result<crate::setup::Requirements, String> {
    tauri::async_runtime::spawn_blocking(crate::setup::check).await.map_err(|e| e.to_string())
}

// Installs Git or the GitHub CLI (winget), then refreshes everything that
// depends on it.
#[tauri::command]
pub async fn install_tool(app: AppHandle, tool: String) -> Result<crate::setup::Requirements, String> {
    tauri::async_runtime::spawn_blocking(move || crate::setup::install(&tool))
        .await
        .map_err(|e| e.to_string())??;
    let store = app.state::<SharedStore>();
    changed(&app, &*lock(&store)?);
    Ok(crate::setup::check())
}

#[tauri::command]
pub fn gh_login_cancel() {
    github::gh_login_cancel();
}

#[tauri::command]
pub fn open_main(app: AppHandle) {
    tray::hide_popup(&app);
    tray::show_main(&app);
}

#[tauri::command]
pub fn resize_popup(app: AppHandle, height: f64) {
    tray::resize_popup(&app, height);
}

#[tauri::command]
pub fn hide_popup(app: AppHandle) {
    tray::hide_popup(&app);
}
