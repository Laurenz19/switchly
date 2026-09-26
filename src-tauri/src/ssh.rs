use crate::hosts::Host;
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

// Each host greets a working key differently, and none gives a shell (so ssh
// exits non-zero even on success): the login is read from the message.
//   GitHub:    "Hi <login>! You've successfully authenticated..."
//   GitLab:    "Welcome to GitLab, @<login>!"
//   Bitbucket: "authenticated via ssh key. ... logged in as <login>."
pub fn login_from_greeting(text: &str) -> Option<String> {
    let between = |start: &str, end: char| {
        text.split(start).nth(1).and_then(|rest| rest.split(end).next()).map(|s| s.trim().to_string())
    };
    between("Welcome to GitLab, @", '!')
        .or_else(|| between("logged in as ", '.'))
        .or_else(|| between("Hi ", '!'))
        .filter(|login| !login.is_empty())
}

pub fn test_connection(host: &Host, private_key: Option<&str>) -> Result<SshTest, String> {
    let mut args: Vec<&str> = vec!["-T"];
    if let Some(key) = private_key {
        args.extend(["-i", key, "-o", "IdentitiesOnly=yes"]);
    }
    let target = host.ssh_target();
    args.extend(["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=10", &target]);
    let out = run("ssh", &args, None)?;
    let text = format!("{}
{}", stdout(&out), stderr(&out));
    Ok(match login_from_greeting(&text) {
        Some(user) => SshTest { ok: true, message: format!("Connected to {} as {user}.", host.name), username: Some(user) },
        None => SshTest {
            ok: false,
            username: None,
            message: if text.contains("Permission denied") {
                format!("{} refused the key. Add the public key to the {} account first.", host.name, host.name)
            } else {
                text.trim().lines().last().map(str::to_string).unwrap_or_else(|| format!("No answer from {}.", host.name))
            },
        },
    })
}

#[cfg(test)]
mod tests {
    use super::login_from_greeting;

    #[test]
    fn reads_the_login_from_each_host_greeting() {
        assert_eq!(
            login_from_greeting("Hi Laurenz19! You've successfully authenticated, but GitHub does not provide shell access."),
            Some("Laurenz19".into())
        );
        assert_eq!(login_from_greeting("Welcome to GitLab, @jane.doe!"), Some("jane.doe".into()));
        assert_eq!(
            login_from_greeting("authenticated via ssh key.

You can use git to connect to Bitbucket. Shell access is disabled.
logged in as jdoe."),
            Some("jdoe".into())
        );
        assert_eq!(login_from_greeting("git@github.com: Permission denied (publickey)."), None);
    }
}
