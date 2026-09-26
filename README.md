<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="">
</p>

<h1 align="center">Switchly</h1>

<p align="center">Use the right GitHub account in every folder, from the Windows tray.</p>

Work with several GitHub accounts, like a personal one and one per client or employer? Tell Switchly which account each folder uses. Every repository inside it then commits with the right name and email and pushes with the right login, and you stop pushing to a client's repo as yourself.

## Install

Download the latest installer from **[Releases](../../releases/latest)**:

| Your PC | File |
|---|---|
| Windows (most PCs) | `Switchly_<version>_x64-setup.exe` |
| Windows on ARM (Snapdragon, Surface Pro X…) | `Switchly_<version>_arm64-setup.exe` |
| Company deployment (GPO, Intune) | `Switchly_<version>_x64_en-US.msi` |

The installer isn't signed yet. If Windows SmartScreen warns, click **More info**, then **Run anyway**.

Switchly needs **Git for Windows**, which includes Git Credential Manager. The **GitHub CLI** (`gh`) is optional.

## Getting started

1. **Add your accounts.** For each one: a label ("Personal", "Client A"), the commit name and email, and the GitHub username.
2. **Give each account its folders.** In the account's **Folders** tab, add the folders that hold its repositories, like `C:\Dev\ClientA`. Every repository inside a folder uses that account. When folders are nested, the deepest one wins.
3. **Connect each account** in the **Connections** tab:
   - **HTTPS** (`https://github.com/...` remotes): sign in once per GitHub account through Git Credential Manager.
   - **SSH** (`git@github.com:...` remotes): create a key for the account, click **Add on GitHub** while signed in with that account, then **Test**.
4. **Pick a global account** with **Make global**. It's used in every repository that no folder covers.
5. **Check a repository** whenever you're unsure: Switchly shows which identity it will commit and push with, where each setting comes from, and what looks wrong.

## Everyday use

- The **tray icon** next to the clock shows the global account on hover.
- **Left click**: a small popup to switch the global account in one click.
- **Right click**: a menu to switch, open Switchly or quit.
- Closing the window keeps Switchly in the tray. **Settings** can start it with Windows.
- Switching the global account also switches the `gh` CLI when `gh` is logged in to that user (`gh auth login` once per account).
- Dark or light theme, in English or French, in **Settings**.

## How it works

Switchly only writes standard git configuration, so your setup keeps working even when Switchly isn't running:

- `~/.gitconfig`: the global identity, plus one `includeIf "gitdir/i:<folder>/"` entry per folder.
- `~/.switchly/<account>.gitconfig`: one file per account with its `user.name`, `user.email`, `core.sshCommand` and the GitHub login Git Credential Manager should use.
- `~/.ssh/id_ed25519_switchly_*`: SSH keys you create in Switchly. Deleting an account never deletes its key.

## Development

Needs Node 22, Rust and the MSVC build tools (see [Tauri's prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev     # run the app with hot reload
npm run check         # type-check and unit tests
npm run tauri build   # installers in src-tauri/target/release/bundle/
npm run icon          # regenerate every icon size from src-tauri/icons/source/icon.png
cd src-tauri && cargo test
```

On an ARM64 PC without the MSVC ARM64 tools, pin the x64 toolchain for this project: `rustup override set stable-x86_64-pc-windows-msvc` in `src-tauri`.

- `src/`: the React UI. `rules.ts` and `diagnose.ts` hold the pure logic and have unit tests. Text lives in `src/locales/` (one file per language, checked against English).
- `src-tauri/src/`: the Rust backend. `git.rs` does all the git config work, `commands.rs` exposes it to the UI, `tray.rs` runs the tray icon and popup.

### Releasing

Push a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`.github/workflows/release.yml`) type-checks and tests, builds the x64 installers (`.exe` and `.msi`) and the ARM64 installer, and publishes them as a GitHub Release. The tag is the version, so `tauri.conf.json` doesn't need bumping.
