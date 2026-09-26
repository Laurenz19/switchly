// The GitHub-side tools: the gh CLI (optional) and Git Credential Manager,
// which ships with Git for Windows and holds the HTTPS logins.
use crate::proc::{run, stderr, stdout};

pub fn gh_available() -> bool {
    run("gh", &["--version"], None).map(|o| o.status.success()).unwrap_or(false)
}

// Read from gh's local config, so no network round trip on every refresh.
pub fn gh_active_user() -> Option<String> {
    let out = run("gh", &["config", "get", "user", "-h", "github.com"], None).ok()?;
    let user = stdout(&out);
    (out.status.success() && !user.is_empty()).then_some(user)
}

// Only switches to a user gh is already logged in as; otherwise explains how
// to add it.
pub fn gh_switch(user: &str) -> Result<(), String> {
    let out = run("gh", &["auth", "switch", "--hostname", "github.com", "--user", user], None)?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!(
            "gh isn't logged in as {user}. Run \"gh auth login\" once with that account. ({})",
            stderr(&out)
        ))
    }
}

pub fn gcm_accounts() -> Result<Vec<String>, String> {
    let out = run("git", &["credential-manager", "github", "list"], None)?;
    if !out.status.success() {
        return Err(format!("Git Credential Manager: {}", stderr(&out)));
    }
    Ok(stdout(&out).lines().map(str::trim).filter(|l| !l.is_empty()).map(String::from).collect())
}

// Opens GCM's own sign-in window (browser or device code) and blocks until
// the user finishes or cancels it. Adds an account; never removes one.
pub fn gcm_login() -> Result<(), String> {
    let out = run("git", &["credential-manager", "github", "login"], None)?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("Sign-in didn't complete: {}", stderr(&out)))
    }
}
