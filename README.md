# Switchly

Switch GitHub accounts per folder, from the Windows tray.

Work for several companies with several GitHub accounts? Tell Switchly which account each folder uses. Every repository inside that folder then commits with the right name and email, pushes with the right SSH key or HTTPS login, and you never push to a client's repo with your personal account again.

## What it does

- **Accounts**: a commit name and email, a GitHub username, and optionally a dedicated SSH key per account.
- **Folder rules**: `C:/Dev/ClientA` → Client A, `C:/Dev/Perso` → Personal. The deepest folder wins when rules are nested.
- **Global account**: the identity used outside every rule's folder, switchable in one click from the tray. It also switches the `gh` CLI when it's logged in to that GitHub user.
- **SSH keys**: create one per account, copy the public key to GitHub, and test the connection.
- **HTTPS logins**: one Git Credential Manager login per GitHub account; each rule picks the right one.
- **Check a repo**: see which identity a repository will commit and push with, where each setting comes from, and what looks wrong (a local `user.email` overriding the rule, recent commits made with another email…).

Switchly only writes standard git configuration, so everything keeps working when it isn't running:

- `~/.gitconfig`: the global identity, plus one `includeIf "gitdir/i:<folder>/"` entry per rule.
- `~/.switchly/<account>.gitconfig`: one file per account (name, email, `core.sshCommand`, GitHub login for HTTPS).

## Development

Needs Node 22, Rust and the MSVC build tools ([Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev     # run the app
npm run check         # type-check + unit tests
npm run tauri build   # MSI and NSIS installers in src-tauri/target/release/bundle/
cd src-tauri && cargo test
```

- `src/`: the React UI. `rules.ts` and `diagnose.ts` hold the pure logic and have unit tests.
- `src-tauri/src/`: the Rust backend. `git.rs` does all the git config work, `commands.rs` exposes it to the UI, `tray.rs` runs the tray icon and popup.
