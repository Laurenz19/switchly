use crate::model::SshTest;
use crate::proc::{run, stderr, stdout};
use std::path::{Path, PathBuf};

pub fn key_path_for(home: &Path, account_id: &str) -> PathBuf {
    home.join(".ssh").join(format!("id_ed25519_switchly_{account_id}"))
}

// Creates a new ed25519 key pair without a passphrase and returns the private
// key's path. Never overwrites an existing key.
pub fn generate_key(home: &Path, account_id: &str, email: &str) -> Result<PathBuf, String> {
    let path = key_path_for(home, account_id);
    if path.exists() {
        return Err(format!("{} already exists.", path.display()));
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    }
    let path_str = path.to_string_lossy().to_string();
    let out = run("ssh-keygen", &["-t", "ed25519", "-C", email, "-f", &path_str, "-N", ""], None)?;
    if !out.status.success() {
        return Err(format!("ssh-keygen failed: {}", stderr(&out)));
    }
    Ok(path)
}

pub fn public_key(private_key: &str) -> Result<String, String> {
    let path = format!("{private_key}.pub");
    std::fs::read_to_string(&path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("Could not read {path}: {e}"))
}

// GitHub answers "Hi <login>! You've successfully authenticated..." on stderr
// and exits 1 (it gives no shell), so success is read from the message.
pub fn test_connection(private_key: Option<&str>) -> Result<SshTest, String> {
    let mut args: Vec<&str> = vec!["-T"];
    if let Some(key) = private_key {
        args.extend(["-i", key, "-o", "IdentitiesOnly=yes"]);
    }
    args.extend([
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=10",
        "git@github.com",
    ]);
    let out = run("ssh", &args, None)?;
    let text = format!("{}\n{}", stdout(&out), stderr(&out));
    let github_user = text
        .split("Hi ")
        .nth(1)
        .and_then(|rest| rest.split('!').next())
        .map(|s| s.trim().to_string());
    Ok(match github_user {
        Some(user) => SshTest {
            ok: true,
            message: format!("Connected to GitHub as {user}."),
            github_user: Some(user),
        },
        None => SshTest {
            ok: false,
            github_user: None,
            message: if text.contains("Permission denied") {
                "GitHub refused the key. Add the public key to the GitHub account first.".into()
            } else {
                text.trim().lines().last().unwrap_or("No answer from GitHub.").to_string()
            },
        },
    })
}
