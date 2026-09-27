<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="">
</p>

<h1 align="center">Switchly</h1>

<p align="center">Use the right GitHub, GitLab or Bitbucket account in every folder, from the Windows tray.</p>

Work with several Git accounts, like a personal GitHub, a work GitLab and a client's Bitbucket? Tell Switchly which account each folder uses. Every repository inside it then commits with the right name and email and pushes with the right login, and you stop pushing to a client's repo as yourself.

<p align="center">
  <img src="docs/screenshots/folders.png" width="720" alt="Switchly's main window: accounts in the sidebar, and the Folders tab of the selected account listing the folders it's used in">
</p>

## Requirements

- **Windows 10 or 11**, x64 or ARM64.
- **[Git for Windows](https://git-scm.com/download/win) (required).** Switchly configures git and doesn't work without it. Git for Windows also installs **Git Credential Manager**, which Switchly uses for HTTPS logins. Keep its default options when installing. To check it's there, run in a terminal:
  ```
  git --version
  git credential-manager --version
  ```
- **OpenSSH**, only for SSH remotes. It's built into Windows 10 and 11.
- **GitHub CLI** (`gh`), optional: when it's installed, switching the global account also switches `gh`.

**Missing Git? Switchly installs it.** The `.exe` installer offers to install Git for Windows when it isn't there, with **winget** (the package manager built into Windows 10 and 11). If you skip it, or install with the `.msi`, Switchly shows a **Requirements** screen at first launch with an **Install** button for Git and one for the GitHub CLI. It's also in **Settings**. Windows may ask for administrator permission while Git installs.

## Install

Download the latest installer from **[Releases](../../releases/latest)**:

| Your PC | File |
|---|---|
| Windows (most PCs) | `Switchly_<version>_x64-setup.exe` |
| Windows on ARM (Snapdragon, Surface Pro X…) | `Switchly_<version>_arm64-setup.exe` |
| Company deployment (GPO, Intune) | `Switchly_<version>_x64_en-US.msi` |

The installer isn't signed yet. If Windows SmartScreen warns, click **More info**, then **Run anyway**.

## Getting started

1. **Add your accounts.** For each one: a label ("Personal", "Client A"), the commit name and email, its platform (GitHub, GitLab or Bitbucket) and its username there.
2. **Give each account its folders.** In the account's **Folders** tab, add the folders that hold its repositories, like `C:\Dev\ClientA`. Every repository inside a folder uses that account. When folders are nested, the deepest one wins.
3. **Connect each account** in the **Connections** tab:
   - **HTTPS** (`https://...` remotes): sign in once per account through Git Credential Manager, which handles GitHub, GitLab and Bitbucket logins.
   - **SSH** (`git@...` remotes): create a key for the account, click **Add on GitHub/GitLab/Bitbucket** while signed in with that account, then **Test**.
4. **Pick a global account** with **Make global**. It's used in every repository that no folder covers.
5. **Optional safety nets:**
   - **Commit signing** (account → **Connections**): signs the account's commits with its SSH key, for a "Verified" badge on GitHub and GitLab. Add the same key on the site a second time, as a signing key.
   - **Commit guard** (**Settings**): git refuses a commit whose email isn't the one of the account that owns the repository's folder. Skip it once with `git commit --no-verify`.
6. **Check a repository** whenever you're unsure: Switchly shows which identity it will commit and push with, where each setting comes from, and what looks wrong.

## Screenshots

| Identity | Connections |
|---|---|
| ![The Identity tab: label, commit name and email, platform (GitHub, GitLab or Bitbucket), username and color](docs/screenshots/identity.png) | ![The Connections tab: the HTTPS login through Git Credential Manager, and the account's SSH key with Copy, Add on GitHub and Test](docs/screenshots/connections.png) |

| Settings | |
|---|---|
| ![Settings: theme, language and startup](docs/screenshots/settings.png) | ![Settings: Git Credential Manager logins, GitHub CLI, and what Switchly changes](docs/screenshots/settings-more.png) |

## Everyday use

- Each account shows its platform with a colored badge: GitHub, GitLab or Bitbucket.
- The **tray icon** next to the clock shows the global account on hover.
- **Left click**: a small popup to switch the global account in one click.
- **Right click**: a menu to switch, open Switchly or quit.
- Closing the window keeps Switchly in the tray. **Settings** can start it with Windows.
- Switching the global account also switches the `gh` CLI when `gh` is logged in to that user (`gh auth login` once per account).
- Dark or light theme, in English or French, in **Settings**.
- **Updates install themselves**: when a new version is out, Switchly offers it at startup (or from **Settings → Updates**). Updates are signed, and Switchly refuses any that isn't.

## How it works

Switchly only writes standard git configuration, and leaves logins to Git Credential Manager: it never stores or sees a token. Your setup keeps working even when Switchly isn't running:

- `~/.gitconfig`: the global identity, plus one `includeIf "gitdir/i:<folder>/"` entry per folder.
- `~/.switchly/<account>.gitconfig`: one file per account with its `user.name`, `user.email`, `core.sshCommand` and the login Git Credential Manager should use on its platform (`credential.https://<site>.username`).
- `~/.ssh/id_ed25519_switchly_*`: SSH keys you create in Switchly. Deleting an account never deletes its key.
- `~/.switchly/hooks/`: the commit guard, used through the global `core.hooksPath` while the guard is on. Each hook also runs the repository's own hook of the same name. Switchly won't replace a global hooks folder you set up yourself.

## Roadmap

Ideas for the next versions, most useful first. Suggestions and pull requests are welcome.

**Rules and setup**
- **Rules by remote, not only by folder.** Use an account for every repository whose remote is `github.com/acme/...`, wherever it sits on disk (git's `includeIf "hasconfig:remote.*.url:..."`, git 2.36+).
- **Assisted clone.** Paste a repository URL; Switchly picks the account from the site and owner, then clones into that account's folder with the right login.
- **Import on first launch.** Detect the existing global identity, Git Credential Manager logins, `~/.ssh` keys and `includeIf` rules, and offer to turn them into accounts.
- **Repository scan.** List every repository on the machine with the account it will use, and flag the ones no rule covers.

**Sharing a setup**
- **Export and import.** Save accounts, folders and settings to a file, and load it into Switchly on another PC, after a reinstall, or to hand a team a ready-made setup (the client's accounts and folder layout).
  - Folders that don't exist on the new machine are mapped interactively, e.g. `C:\Dev\` → `D:\Projects\`.
  - Private SSH keys and logins are never exported: the import points at existing keys or creates new ones, and each login is signed in again through Git Credential Manager.

**Fixing problems**
- **One-click fixes in "Check a repo":** remove a local `user.email` that overrides the rule, add the repository's folder to an account, or fix the author of commits made with the wrong account before they're pushed.
- **Upload SSH keys automatically** to GitHub through the `gh` CLI (`gh ssh-key add`), for authentication and signing, without Switchly storing any token.

**Windows integration**
- **A global keyboard shortcut** to open the tray popup.
- **An Explorer context menu** on folders: "Which account?" and "Use the account…".
- **A Windows 11 widget** showing the global account and switching it.
- **A VS Code extension** showing the open repository's account in the status bar.

**AI coding agents**

Agents like Claude Code, Copilot or Cursor now commit and push on your behalf. Folder rules and the commit guard already apply to them, since they're plain git: an agent committing with the wrong email is refused like anyone else. Next:
- **A `switchly check` command** with machine-readable output, so an agent can verify the account before committing or pushing.
- **An MCP server** so agents can ask Switchly which account a repository uses, and whether a push is safe.

**Distribution**
- **A signed installer** (or a Microsoft Store listing), so Windows SmartScreen stops warning.
- **More languages.**

## Development

Needs Node 22, Rust and the MSVC build tools (see [Tauri's prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev     # run the app with hot reload
npm run check         # type-check and unit tests
npm run tauri build   # installers in src-tauri/target/release/bundle/ (see below)
npm run icon          # regenerate every icon size from src-tauri/icons/source/icon.png
cd src-tauri && cargo test
```

`tauri build` also signs the update packages, so it needs the updater's private key: set `TAURI_SIGNING_PRIVATE_KEY` to its path, or build without update packages with `npm run tauri build -- --config '{"bundle":{"createUpdaterArtifacts":false}}'`.

On an ARM64 PC without the MSVC ARM64 tools, pin the x64 toolchain for this project: `rustup override set stable-x86_64-pc-windows-msvc` in `src-tauri`.

- `src/`: the React UI. `rules.ts` and `diagnose.ts` hold the pure logic and have unit tests. Text lives in `src/locales/` (one file per language, checked against English).
- `src-tauri/src/`: the Rust backend. `git.rs` does all the git config work, `commands.rs` exposes it to the UI, `tray.rs` runs the tray icon and popup.

### Releasing

Push a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`.github/workflows/release.yml`) type-checks and tests, builds the x64 installers (`.exe` and `.msi`) and the ARM64 installer, and publishes them as a GitHub Release, with the signed update packages and the `latest.json` manifest installed apps check. The tag is the version, so `tauri.conf.json` doesn't need bumping.

The updater's private key is the repository secret `TAURI_SIGNING_PRIVATE_KEY`; its public half is in `tauri.conf.json`. **Keep a copy of the private key**: without it, installed apps can't be updated anymore.
