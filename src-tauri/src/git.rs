// Everything Switchly does to git goes through `git config`, never by editing
// ~/.gitconfig by hand, so git's own quoting and locking apply.
//
// Layout:
// - ~/.switchly/<account-id>.gitconfig: one file per account (name, email,
//   SSH key, GitHub login for HTTPS), fully rewritten on every save.
// - ~/.gitconfig: one `includeIf "gitdir/i:<folder>/"` per rule, pointing at
//   an account file. Only entries pointing into ~/.switchly/ are touched.
use crate::model::{Account, ConfigValue, EmailCount, RepoFacts, Rule};
use crate::proc::{run, stderr, stdout};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Output;

const GITHUB_URL: &str = "https://github.com";
const CREDENTIAL_KEY: &str = "credential.https://github.com.username";

fn git(args: &[&str]) -> Result<Output, String> {
    run("git", args, None)
}

fn git_ok(args: &[&str]) -> Result<String, String> {
    let out = git(args)?;
    if out.status.success() {
        Ok(stdout(&out))
    } else {
        Err(format!("git {} failed: {}", args.join(" "), stderr(&out)))
    }
}

// A single value, or None when it's unset (git exits 1).
fn get_value(args: &[&str], cwd: Option<&Path>) -> Result<Option<String>, String> {
    let out = run("git", args, cwd)?;
    match out.status.code() {
        Some(0) => Ok(Some(stdout(&out))),
        Some(1) => Ok(None),
        _ => Err(format!("git {} failed: {}", args.join(" "), stderr(&out))),
    }
}

// Unsetting a key that isn't set exits 5; that's fine here.
fn unset_global(key: &str) -> Result<(), String> {
    let out = git(&["config", "--global", "--unset-all", key])?;
    match out.status.code() {
        Some(0) | Some(5) => Ok(()),
        _ => Err(format!("git config --unset-all {key} failed: {}", stderr(&out))),
    }
}

pub fn to_git_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

// Same rules as normalizeFolder() in src/rules.ts.
pub fn normalize_folder(folder: &str) -> String {
    let mut s = folder.trim().replace('\\', "/");
    while s.contains("//") {
        s = s.replace("//", "/");
    }
    if !s.ends_with('/') {
        s.push('/');
    }
    s
}

pub fn account_file(managed_dir: &Path, id: &str) -> PathBuf {
    managed_dir.join(format!("{id}.gitconfig"))
}

pub fn ssh_command(key_path: &str) -> String {
    format!("ssh -i \"{}\" -o IdentitiesOnly=yes", key_path.replace('\\', "/"))
}

pub fn write_account_file(managed_dir: &Path, account: &Account) -> Result<(), String> {
    std::fs::create_dir_all(managed_dir).map_err(|e| format!("Could not create {}: {e}", managed_dir.display()))?;
    let file = account_file(managed_dir, &account.id);
    std::fs::write(
        &file,
        format!("# Managed by Switchly for \"{}\". Changes here are overwritten.\n", account.label),
    )
    .map_err(|e| format!("Could not write {}: {e}", file.display()))?;
    let f = to_git_path(&file);
    git_ok(&["config", "--file", &f, "user.name", &account.name])?;
    git_ok(&["config", "--file", &f, "user.email", &account.email])?;
    if !account.github_user.is_empty() {
        git_ok(&["config", "--file", &f, CREDENTIAL_KEY, &account.github_user])?;
    }
    if let Some(key) = &account.ssh_key_path {
        git_ok(&["config", "--file", &f, "core.sshCommand", &ssh_command(key)])?;
    }
    Ok(())
}

pub fn remove_account_file(managed_dir: &Path, id: &str) {
    let _ = std::fs::remove_file(account_file(managed_dir, id));
}

// (key, value) of every includeIf path in ~/.gitconfig that points into the
// managed dir. `-z` because folder names may contain spaces: each entry is
// "key\nvalue\0".
fn managed_includes(managed_dir: &Path) -> Result<Vec<(String, String)>, String> {
    let out = git(&["config", "--global", "-z", "--get-regexp", r"^includeif\..*\.path$"])?;
    if out.status.code() == Some(1) {
        return Ok(Vec::new());
    }
    if !out.status.success() {
        return Err(format!("Could not read includeIf entries: {}", stderr(&out)));
    }
    let prefix = to_git_path(managed_dir).to_lowercase();
    Ok(String::from_utf8_lossy(&out.stdout)
        .split('\0')
        .filter_map(|entry| entry.split_once('\n'))
        .filter(|(_, value)| value.replace('\\', "/").to_lowercase().starts_with(&prefix))
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect())
}

pub fn sync_rules(managed_dir: &Path, rules: &[Rule]) -> Result<(), String> {
    for (key, value) in managed_includes(managed_dir)? {
        git_ok(&["config", "--global", "--fixed-value", "--unset-all", &key, &value])?;
    }
    // Shortest folder first: a later include wins, so the most specific
    // folder must come last (matchRule() in src/rules.ts assumes this).
    let mut sorted: Vec<&Rule> = rules.iter().collect();
    sorted.sort_by_key(|r| normalize_folder(&r.folder).len());
    for rule in sorted {
        let key = format!("includeIf.gitdir/i:{}.path", normalize_folder(&rule.folder));
        let value = to_git_path(&account_file(managed_dir, &rule.account_id));
        git_ok(&["config", "--global", "--add", &key, &value])?;
    }
    Ok(())
}

pub fn global_identity() -> Result<(Option<String>, Option<String>), String> {
    let name = get_value(&["config", "--global", "--get", "user.name"], None)?;
    let email = get_value(&["config", "--global", "--get", "user.email"], None)?;
    Ok((name, email))
}

// The identity used outside every rule's folder.
pub fn switch_global(account: &Account) -> Result<(), String> {
    git_ok(&["config", "--global", "user.name", &account.name])?;
    git_ok(&["config", "--global", "user.email", &account.email])?;
    if account.github_user.is_empty() {
        unset_global(CREDENTIAL_KEY)?;
    } else {
        git_ok(&["config", "--global", CREDENTIAL_KEY, &account.github_user])?;
    }
    match &account.ssh_key_path {
        Some(key) => {
            git_ok(&["config", "--global", "core.sshCommand", &ssh_command(key)])?;
        }
        None => unset_global("core.sshCommand")?,
    }
    Ok(())
}

// "scope\torigin\tvalue", from --show-scope --show-origin.
fn config_value(repo: &Path, key: &str) -> Result<Option<ConfigValue>, String> {
    let line = get_value(&["config", "--show-scope", "--show-origin", "--get", key], Some(repo))?;
    Ok(line.and_then(|l| {
        let mut parts = l.splitn(3, '\t');
        Some(ConfigValue {
            scope: parts.next()?.to_string(),
            origin: parts.next()?.to_string(),
            value: parts.next()?.to_string(),
        })
    }))
}

pub fn repo_facts(path: &Path) -> Result<RepoFacts, String> {
    let top = run("git", &["rev-parse", "--show-toplevel"], Some(path))?;
    if !top.status.success() {
        return Ok(RepoFacts::default());
    }
    let top_level = stdout(&top);
    let repo = Path::new(&top_level);

    // --get-urlmatch applies URL-scoped sections like credential.https://github.com.*
    // (it can't be combined with --show-origin).
    let credential_user = get_value(&["config", "--get-urlmatch", "credential.username", GITHUB_URL], Some(repo))?;
    let remote_url = get_value(&["config", "--get", "remote.origin.url"], Some(repo))?;

    let mut counts: HashMap<String, u32> = HashMap::new();
    let log = run("git", &["log", "-n", "50", "--format=%ae"], Some(repo))?;
    if log.status.success() {
        for email in stdout(&log).lines().filter(|l| !l.is_empty()) {
            *counts.entry(email.to_string()).or_default() += 1;
        }
    }
    let mut recent_emails: Vec<EmailCount> =
        counts.into_iter().map(|(email, count)| EmailCount { email, count }).collect();
    recent_emails.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(RepoFacts {
        is_repo: true,
        name: config_value(repo, "user.name")?,
        email: config_value(repo, "user.email")?,
        ssh_command: config_value(repo, "core.sshCommand")?,
        top_level: Some(top_level),
        credential_user,
        remote_url,
        recent_emails,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_folders_like_the_frontend() {
        assert_eq!(normalize_folder("C:\\Dev\\Client A"), "C:/Dev/Client A/");
        assert_eq!(normalize_folder("C:/Dev/"), "C:/Dev/");
        assert_eq!(normalize_folder("C:\\\\Dev\\\\x"), "C:/Dev/x/");
    }

    #[test]
    fn quotes_the_key_path_in_ssh_command() {
        assert_eq!(
            ssh_command("C:\\Users\\me\\.ssh\\id work"),
            "ssh -i \"C:/Users/me/.ssh/id work\" -o IdentitiesOnly=yes"
        );
    }
}
