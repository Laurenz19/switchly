// The tools Switchly relies on, and installing the missing ones with winget
// (the package manager built into Windows 10 and 11), so a PC without Git
// can still get going from inside the app.
use crate::proc::{run, stdout};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Requirements {
    // Required: Switchly only writes git configuration.
    pub git: bool,
    // Git Credential Manager (ships with Git for Windows): HTTPS logins.
    pub gcm: bool,
    // OpenSSH (built into Windows): SSH keys and remotes.
    pub ssh: bool,
    // GitHub CLI: optional.
    pub gh: bool,
    // Whether the missing tools can be installed from Switchly.
    pub winget: bool,
}

fn works(program: &str, args: &[&str]) -> bool {
    run(program, args, None).map(|o| o.status.success()).unwrap_or(false)
}

// Development builds can pretend tools are missing, to try the setup screens
// on a PC that has everything: SWITCHLY_SIMULATE_MISSING=git,gh
fn simulated_missing(tool: &str) -> bool {
    cfg!(debug_assertions)
        && std::env::var("SWITCHLY_SIMULATE_MISSING").is_ok_and(|v| v.split(',').any(|t| t.trim() == tool))
}

pub fn check() -> Requirements {
    refresh_path();
    let has = |tool: &str, program: &str, args: &[&str]| !simulated_missing(tool) && works(program, args);
    Requirements {
        git: has("git", "git", &["--version"]),
        gcm: has("gcm", "git", &["credential-manager", "--version"]),
        ssh: has("ssh", "ssh", &["-V"]),
        gh: has("gh", "gh", &["--version"]),
        winget: works("winget", &["--version"]),
    }
}

// Installs Git or the GitHub CLI with winget. The installer may show a
// Windows administrator prompt, which the user accepts.
pub fn install(tool: &str) -> Result<(), String> {
    let id = match tool {
        "git" => "Git.Git",
        "gh" => "GitHub.cli",
        _ => return Err(format!("Switchly can't install {tool}.")),
    };
    let out = run(
        "winget",
        &["install", "--id", id, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements"],
        None,
    )?;
    let installed = check();
    let ok = if tool == "git" { installed.git } else { installed.gh };
    if ok {
        Ok(())
    } else {
        let detail = stdout(&out).lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("").trim().to_string();
        Err(format!("The installation didn't complete (winget exit code {:?}). {detail}", out.status.code()))
    }
}

// A program installed after Switchly started isn't on Switchly's PATH:
// Windows only gives new processes the updated PATH. Rebuild it from the
// registry (system then user, as Windows does), keeping any extra entries
// this process inherited, so a fresh Git works without restarting.
#[cfg(windows)]
pub fn refresh_path() {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let read = |root, key: &str| {
        RegKey::predef(root)
            .open_subkey(key)
            .and_then(|k| k.get_value::<String, _>("Path"))
            .unwrap_or_default()
    };
    let machine = read(HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment");
    let user = read(HKEY_CURRENT_USER, "Environment");
    let current = std::env::var("PATH").unwrap_or_default();

    let mut entries: Vec<String> = Vec::new();
    for entry in machine.split(';').chain(user.split(';')).map(expand_env).chain(current.split(';').map(String::from)) {
        let entry = entry.trim().to_string();
        if !entry.is_empty() && !entries.iter().any(|e| e.eq_ignore_ascii_case(&entry)) {
            entries.push(entry);
        }
    }
    std::env::set_var("PATH", entries.join(";"));
}

#[cfg(not(windows))]
pub fn refresh_path() {}

// Registry PATHs hold unexpanded %VARIABLES% (e.g. %SystemRoot%\system32).
fn expand_env(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after = &rest[start + 1..];
        match after.find('%') {
            Some(end) => {
                let name = &after[..end];
                match std::env::var(name) {
                    Ok(value) if !name.is_empty() => out.push_str(&value),
                    _ => out.push_str(&rest[start..start + end + 2]),
                }
                rest = &after[end + 1..];
            }
            None => {
                out.push_str(&rest[start..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

#[cfg(test)]
mod tests {
    use super::expand_env;

    #[test]
    fn expands_known_variables_and_keeps_unknown_ones() {
        std::env::set_var("SWITCHLY_TEST_ROOT", r"C:\Win");
        assert_eq!(expand_env(r"%SWITCHLY_TEST_ROOT%\system32"), r"C:\Win\system32");
        assert_eq!(expand_env(r"%SWITCHLY_NOPE%\x"), r"%SWITCHLY_NOPE%\x");
        assert_eq!(expand_env("plain;path"), "plain;path");
        assert_eq!(expand_env("100%"), "100%");
    }
}
