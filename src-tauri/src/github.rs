// The hosting-side tools: the gh CLI (optional, GitHub only) and Git
// Credential Manager, which ships with Git for Windows and holds the HTTPS
// logins for GitHub, GitLab and Bitbucket.
use crate::hosts::Host;
use crate::proc::{command, run, stderr, stdout};
use std::io::Write;
use std::process::{Output, Stdio};

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
//
// The user asked for this prompt, so it overrides settings inherited from the
// environment that disable prompts (GCM_INTERACTIVE=never,
// GIT_TERMINAL_PROMPT=0 from a CI-like shell); otherwise GCM fails with
// "Cannot prompt because user interactivity has been disabled".
pub fn gcm_login() -> Result<(), String> {
    let out = command("git")
        .args(["credential-manager", "github", "login"])
        .env("GCM_INTERACTIVE", "always")
        .env_remove("GIT_TERMINAL_PROMPT")
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("Sign-in didn't complete: {}", stderr(&out)))
    }
}

// Runs `git credential <action>` with the given request on stdin: the
// standard protocol git itself uses, which works for every host GCM knows,
// unlike `git credential-manager github ...` (GitHub only). Secrets only ever
// travel between git's processes here; nothing is logged or returned to the UI.
fn credential(action: &str, input: &str, interactive: bool) -> Result<Output, String> {
    let mut cmd = command("git");
    cmd.args(["credential", action]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if interactive {
        // See gcm_login: the user asked for this sign-in window.
        cmd.env("GCM_INTERACTIVE", "always").env_remove("GIT_TERMINAL_PROMPT");
    } else {
        cmd.env("GCM_INTERACTIVE", "never").env("GIT_TERMINAL_PROMPT", "0");
    }
    let mut child = cmd.spawn().map_err(|e| format!("Could not run git: {e}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).map_err(|e| format!("Could not talk to git: {e}"))?;
    }
    child.wait_with_output().map_err(|e| format!("git credential {action} failed: {e}"))
}

fn request(host: &Host, username: &str) -> String {
    format!("protocol=https\nhost={}\nusername={username}\n\n", host.domain)
}

// Whether GCM already holds a login for this user on this host. Never
// prompts: without one, GCM fails fast instead.
pub fn credential_status(host: &Host, username: &str) -> bool {
    credential("fill", &request(host, username), false)
        .map(|out| out.status.success() && String::from_utf8_lossy(&out.stdout).contains("password="))
        .unwrap_or(false)
}

// Opens GCM's sign-in window for this host (GitHub, GitLab or Bitbucket),
// then asks git to store the login, as it does after a successful push.
pub fn credential_login(host: &Host, username: &str) -> Result<(), String> {
    let filled = credential("fill", &request(host, username), true)?;
    if !filled.status.success() {
        return Err(format!("Sign-in to {} didn't complete: {}", host.name, stderr(&filled)));
    }
    let stored = credential("approve", &String::from_utf8_lossy(&filled.stdout), false)?;
    if stored.status.success() {
        Ok(())
    } else {
        Err(format!("Signed in, but the login couldn't be saved: {}", stderr(&stored)))
    }
}

// The gh sign-in in progress, so the UI can cancel it.
static GH_LOGIN_PID: std::sync::Mutex<Option<u32>> = std::sync::Mutex::new(None);

pub const GH_DEVICE_URL: &str = "https://github.com/login/device";

// "! One-time code (ABCD-1234) copied to clipboard" or
// "! First copy your one-time code: ABCD-1234", depending on gh's version.
pub fn device_code(line: &str) -> Option<String> {
    if !line.to_lowercase().contains("code") {
        return None;
    }
    line.split(|c: char| !c.is_ascii_alphanumeric() && c != '-')
        .find(|w| {
            let b = w.as_bytes();
            b.len() == 9 && b[4] == b'-' && w.chars().filter(|c| *c != '-').all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
        })
        .map(str::to_string)
}

// Signs gh in to github.com through the device flow, without a terminal:
// run non-interactively, gh prints a one-time code and waits until the user
// confirms it on GitHub. `on_code` gets the code as soon as gh shows it.
// Git's own credentials aren't touched: non-interactive gh doesn't set
// itself up as git's credential helper, so Git Credential Manager stays.
pub fn gh_login_device(on_code: impl Fn(&str)) -> Result<(), String> {
    use std::io::{BufRead, BufReader};
    let mut child = command("gh")
        .args(["auth", "login", "--hostname", "github.com", "--web", "--skip-ssh-key", "--git-protocol", "https"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not run gh: {e}"))?;
    if let Ok(mut pid) = GH_LOGIN_PID.lock() {
        *pid = Some(child.id());
    }
    let mut last = String::new();
    if let Some(err) = child.stderr.take() {
        for line in BufReader::new(err).lines().map_while(Result::ok) {
            if let Some(code) = device_code(&line) {
                on_code(&code);
            }
            if !line.trim().is_empty() {
                last = line.trim().to_string();
            }
        }
    }
    let status = child.wait().map_err(|e| format!("gh sign-in failed: {e}"));
    if let Ok(mut pid) = GH_LOGIN_PID.lock() {
        *pid = None;
    }
    if status?.success() {
        Ok(())
    } else {
        Err(format!("The gh sign-in didn't complete. {last}"))
    }
}

pub fn gh_login_cancel() {
    let pid = GH_LOGIN_PID.lock().ok().and_then(|mut p| p.take());
    if let Some(pid) = pid {
        let _ = run("taskkill", &["/PID", &pid.to_string(), "/T", "/F"], None);
    }
}

#[cfg(test)]
mod tests {
    use super::device_code;

    #[test]
    fn reads_the_device_code_from_both_gh_formats() {
        assert_eq!(device_code("! One-time code (AB12-CD34) copied to clipboard"), Some("AB12-CD34".into()));
        assert_eq!(device_code("! First copy your one-time code: 9F3A-77QZ"), Some("9F3A-77QZ".into()));
        assert_eq!(device_code("Open this URL to continue in your web browser: https://github.com/login/device"), None);
        assert_eq!(device_code("- Logged in as Laurenz19"), None);
    }
}
