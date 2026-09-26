// The commit guard: a global git hook that refuses a commit whose email isn't
// the one of the account owning the repo's folder (e.g. a repo-local
// user.email overriding the folder's account). Installed through the global
// core.hooksPath, pointing at ~/.switchly/hooks.
//
// core.hooksPath replaces each repo's .git/hooks, so every client-side hook
// here passes through to the repo's own hook of the same name: repos keep
// their hooks. (A repo that sets its own core.hooksPath, like husky, isn't
// affected at all: its local setting wins over the global one.)
use crate::git::{normalize_folder, to_git_path};
use crate::model::Config;
use crate::proc::{run, stderr, stdout};
use std::path::{Path, PathBuf};

const HOOKS: [&str; 15] = [
    "applypatch-msg",
    "pre-applypatch",
    "post-applypatch",
    "pre-merge-commit",
    "prepare-commit-msg",
    "commit-msg",
    "post-commit",
    "pre-rebase",
    "post-checkout",
    "post-merge",
    "pre-push",
    "post-rewrite",
    "push-to-checkout",
    "pre-auto-gc",
    "sendemail-validate",
];

// Runs the repo's own hook of the same name, if it has one.
const PASS_THROUGH: &str = r#"
own="$(git rev-parse --git-common-dir)/hooks/$(basename "$0")"
if [ -x "$own" ]; then exec "$own" "$@"; fi
exit 0
"#;

fn guard_script(rules: &str) -> String {
    format!(
        r#"#!/bin/sh
# Switchly commit guard. Managed by Switchly: changes here are overwritten.
# Refuses a commit whose email isn't the one of the account that owns this
# repository's folder. To skip it once: git commit --no-verify
rules="{rules}"
top="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$top" ] && [ -f "$rules" ]; then
  here="$(printf '%s/' "$top" | tr 'A-Z' 'a-z')"
  best=0
  want=""
  label=""
  tab="$(printf '\t')"
  while IFS="$tab" read -r folder email name; do
    f="$(printf '%s' "$folder" | tr 'A-Z' 'a-z')"
    case "$here" in
      "$f"*)
        if [ "${{#f}}" -gt "$best" ]; then best="${{#f}}"; want="$email"; label="$name"; fi ;;
    esac
  done < "$rules"
  if [ -n "$want" ]; then
    got="$(git config user.email)"
    if [ "$(printf '%s' "$got" | tr 'A-Z' 'a-z')" != "$(printf '%s' "$want" | tr 'A-Z' 'a-z')" ]; then
      echo "Switchly: this repository belongs to $label ($want)," >&2
      echo "but this commit would use ${{got:-no email}}." >&2
      echo "Fix the repository's config (git config --unset user.email) or commit with --no-verify." >&2
      exit 1
    fi
  fi
fi
{PASS_THROUGH}"#
    )
}

pub fn hooks_dir(managed_dir: &Path) -> PathBuf {
    managed_dir.join("hooks")
}

fn rules_file(managed_dir: &Path) -> PathBuf {
    managed_dir.join("guard.tsv")
}

// "folder<TAB>email<TAB>label" per rule, read by the pre-commit hook.
// Rewritten on every change, whether or not the guard is on.
pub fn write_rules(managed_dir: &Path, config: &Config) -> Result<(), String> {
    let lines: Vec<String> = config
        .rules
        .iter()
        .filter_map(|r| {
            let a = config.accounts.iter().find(|a| a.id == r.account_id)?;
            let clean = |s: &str| s.replace(['\t', '\n', '\r'], " ");
            Some(format!("{}\t{}\t{}\n", normalize_folder(&r.folder), clean(&a.email), clean(&a.label)))
        })
        .collect();
    std::fs::create_dir_all(managed_dir).map_err(|e| e.to_string())?;
    std::fs::write(rules_file(managed_dir), lines.concat()).map_err(|e| format!("Could not write the guard rules: {e}"))
}

fn write_hooks(managed_dir: &Path) -> Result<(), String> {
    let dir = hooks_dir(managed_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let write = |name: &str, body: &str| {
        std::fs::write(dir.join(name), body).map_err(|e| format!("Could not write the {name} hook: {e}"))
    };
    write("pre-commit", &guard_script(&to_git_path(&rules_file(managed_dir))))?;
    for name in HOOKS {
        write(name, &format!("#!/bin/sh\n# Managed by Switchly: runs the repository's own {name} hook.{PASS_THROUGH}"))?;
    }
    Ok(())
}

fn global_hooks_path() -> Option<String> {
    let out = run("git", &["config", "--global", "--get", "core.hooksPath"], None).ok()?;
    let value = stdout(&out);
    (out.status.success() && !value.is_empty()).then_some(value)
}

fn is_ours(value: &str, managed_dir: &Path) -> bool {
    value.replace('\\', "/").trim_end_matches('/').eq_ignore_ascii_case(&to_git_path(&hooks_dir(managed_dir)))
}

pub fn is_enabled(managed_dir: &Path) -> bool {
    global_hooks_path().is_some_and(|v| is_ours(&v, managed_dir))
}

pub fn enable(managed_dir: &Path, config: &Config) -> Result<(), String> {
    if let Some(existing) = global_hooks_path() {
        if !is_ours(&existing, managed_dir) {
            return Err(format!(
                "Git already uses its own global hooks folder ({existing}). Switchly won't replace it."
            ));
        }
    }
    write_rules(managed_dir, config)?;
    write_hooks(managed_dir)?;
    let path = to_git_path(&hooks_dir(managed_dir));
    let out = run("git", &["config", "--global", "core.hooksPath", &path], None)?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("Could not turn the guard on: {}", stderr(&out)))
    }
}

pub fn disable(managed_dir: &Path) -> Result<(), String> {
    if is_enabled(managed_dir) {
        let out = run("git", &["config", "--global", "--unset", "core.hooksPath"], None)?;
        if !out.status.success() {
            return Err(format!("Could not turn the guard off: {}", stderr(&out)));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Account, Rule};

    fn git_in(dir: &Path, args: &[&str]) -> std::process::Output {
        run("git", args, Some(dir)).expect("git runs")
    }

    // Real git + sh: a repo under a folder rule, the hooks enabled through a
    // repo-local core.hooksPath (the global config is left alone).
    #[test]
    fn refuses_a_commit_with_the_wrong_email_and_allows_the_right_one() {
        let root = std::env::temp_dir().join(format!("switchly-guard-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let managed = root.join("managed");
        let repo = root.join("work").join("api");
        std::fs::create_dir_all(&repo).unwrap();

        let config = Config {
            accounts: vec![Account {
                id: "w".into(),
                label: "Work".into(),
                name: "Me".into(),
                email: "me@work.com".into(),
                host: "github".into(),
                username: String::new(),
                ssh_key_path: None,
                sign_commits: false,
                color: String::new(),
            }],
            rules: vec![Rule { folder: to_git_path(&root.join("work")), account_id: "w".into() }],
            language: None,
        };
        write_rules(&managed, &config).unwrap();
        write_hooks(&managed).unwrap();

        git_in(&repo, &["init", "-q"]);
        git_in(&repo, &["config", "core.hooksPath", &to_git_path(&hooks_dir(&managed))]);
        git_in(&repo, &["config", "user.name", "Me"]);

        git_in(&repo, &["config", "user.email", "me@gmail.com"]);
        let refused = git_in(&repo, &["commit", "-q", "--allow-empty", "-m", "wrong"]);
        assert!(!refused.status.success(), "the wrong email must be refused");
        assert!(stderr(&refused).contains("belongs to Work"), "got: {}", stderr(&refused));

        git_in(&repo, &["config", "user.email", "Me@Work.com"]);
        let allowed = git_in(&repo, &["commit", "-q", "--allow-empty", "-m", "right"]);
        assert!(allowed.status.success(), "the right email must pass: {}", stderr(&allowed));

        let _ = std::fs::remove_dir_all(&root);
    }
}
