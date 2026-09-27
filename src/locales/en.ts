// The reference dictionary: every other locale must have exactly these keys
// (fr.ts is typed as Messages, so a missing or extra key fails `tsc`).
// Strings with {name} placeholders are filled by fill() in i18n.tsx, which
// can insert markup; plain functions are for text-only interpolation.

const folderCount = (n: number): string => (n === 1 ? '1 folder' : `${n} folders`)

export const en = {
  languageName: 'English',

  common: {
    cancel: 'Cancel',
    checking: 'Checking…'
  },

  nav: {
    accounts: 'Accounts',
    addAccount: 'Add account',
    checkRepo: 'Check a repo',
    settings: 'Settings',
    global: 'Global',
    folderCount
  },

  account: {
    sections: 'Account sections',
    identity: 'Identity',
    folders: (n: number) => `Folders (${n})`,
    connections: 'Connections',
    globalPill: '✓ Global account',
    globalPillTitle: 'Used in every repo that no folder covers',
    makeGlobal: 'Make global',
    makeGlobalTitle: 'Use this account in every repo that no folder covers'
  },

  folders: {
    title: 'Folders',
    intro: 'Every repository inside these folders commits and pushes as {label}. When folders are nested, the deepest one wins.',
    emptyTitle: 'No folders yet',
    emptyHint: "This account is only used while it's the global one.",
    remove: 'Remove',
    removeLabel: (folder: string) => `Remove ${folder}`,
    add: 'Add a folder',
    outside: 'Outside every folder: {label} (global)',
    noIdentity: 'no identity',
    chooseTitle: (label: string) => `Choose a folder for ${label}`,
    alreadyHere: (folder: string) => `${folder} is already in this account's folders.`,
    moveTitle: 'Move folder',
    moveBody: (folder: string, other: string, label: string) => `${folder} currently uses ${other}.\n\nUse ${label} for it instead?`,
    moveOk: 'Move it',
    anotherAccount: 'another account'
  },

  editor: {
    newTitle: 'New account',
    title: 'Identity',
    label: 'Label',
    labelPlaceholder: 'Personal, Client A…',
    name: 'Commit name',
    namePlaceholder: 'Jane Doe',
    email: 'Commit email',
    emailPlaceholder: 'jane@example.com',
    platform: 'Platform',
    username: (host: string) => `${host} username`,
    usernamePlaceholder: 'Optional: picks the HTTPS login (and gh on GitHub)',
    color: 'Color',
    colorLabel: (c: string) => `Color ${c}`,
    add: 'Add account',
    save: 'Save',
    saved: 'Saved',
    delete: 'Delete account',
    deleteTitle: 'Delete account',
    deleteBody: (label: string) =>
      `Delete "${label}"?\n\nIts folder rules are removed too. Its SSH key file stays on disk, and the global git identity isn't changed.`,
    deleteOk: 'Delete'
  },

  ssh: {
    title: 'SSH key',
    hint: (domain: string, host: string) => `For git@${domain}:… remotes. Each ${host} account needs its own key.`,
    key: 'Key',
    uses: 'Uses',
    defaultKey: 'your default key (~/.ssh/id_*)',
    copy: 'Copy',
    copied: 'Copied',
    addOnHost: (host: string) => `Add on ${host}`,
    addOnHostTitle: (host: string, user: string) => `Sign in to ${host} as ${user} first`,
    create: 'Create a key',
    test: 'Test',
    testing: 'Testing…',
    addWhileSignedIn: (host: string, user: string) => `Add it while signed in to ${host} as ${user}.`,
    useAnother: 'Use another key…',
    useDefault: 'Use the default key',
    pickTitle: 'Choose a private SSH key',
    thisAccount: 'this account',
    belongsTo: (actual: string, expected: string) => ` This key belongs to ${actual}, not ${expected}.`
  },

  signing: {
    title: 'Commit signing',
    hint: (host: string) => `Adds a "Verified" badge to your commits on ${host}: proof they really come from you.`,
    toggle: "Sign this account's commits",
    needsKey: 'Needs an SSH key: create one or pick one in the SSH key card.',
    onHint: (host: string) => `Signs with the same SSH key. Add it on ${host} a second time, as a signing key.`,
    githubTip: 'On GitHub, choose "Signing Key" as the key type.',
    addKey: (host: string) => `Add the signing key on ${host}`,
    off: "Off: this account's commits aren't signed, even if the global account signs."
  },

  https: {
    title: 'HTTPS login',
    hint: (domain: string) => `For https://${domain}/… remotes, through Git Credential Manager.`,
    noUser: (host: string) => `Add a ${host} username in Identity to pin this account's login.`,
    signedIn: (user: string) => `Signed in as ${user}`,
    notSignedIn: (user: string) => `Not signed in as ${user} yet`,
    signIn: (user: string) => `Sign in as ${user}`,
    waiting: 'Waiting for sign-in…',
    switchBrowser: (host: string) => `If your browser is signed in to another ${host} account, switch there first.`
  },

  diagnose: {
    title: 'Check a repository',
    hint: "See which identity a repository's commits and pushes will use, and why.",
    choose: 'Choose a repository…',
    again: 'Check again',
    pickTitle: 'Choose a repository',
    details: 'Details',
    name: 'Name',
    email: 'Email',
    sshCommand: 'SSH command',
    httpsLogin: 'HTTPS login',
    remote: 'Remote',
    signing: 'Signing',
    defaultSsh: 'default (~/.ssh/id_*)',
    notPinned: 'not pinned',
    none: 'none',
    notSet: 'not set',
    from: (source: string) => ` · from ${source}`,
    originRule: (label: string) => `folder rule (${label})`,
    deletedAccount: 'deleted account',
    originLocal: 'this repo (.git/config)',
    originGlobal: 'global (~/.gitconfig)'
  },

  // Used by diagnose.ts; kept as data so the logic stays testable.
  findings: {
    notRepo: 'This folder is not a git repository.',
    noEmail: 'No commit email is set.',
    noEmailDetail: 'Git will refuse to commit until user.email is set.',
    localOverride: (email: string) => `This repo overrides the email locally (${email}).`,
    localOverrideRule: (label: string) =>
      `Its own .git/config wins over the rule for ${label}. Remove it with: git config --unset user.email`,
    localOverrideNoRule: 'Its own .git/config sets user.email, so no rule or global switch applies here.',
    ruleOk: (label: string, email: string, folder: string) => `Commits use ${label} (${email}), from the rule for ${folder}.`,
    ruleLoses: (label: string, email: string) => `A rule says ${label}, but commits would use ${email}.`,
    ruleLosesDetail: 'Another config file wins over the rule. Check the origin below.',
    noRule: (who: string) => `No rule covers this repo: commits use the global identity (${who}).`,
    noRuleDetail: 'Add a folder to an account to pin it to this repo.',
    otherEmails: 'Recent commits use other emails.',
    otherEmailsDetail: (list: string) =>
      `${list}. Normal on a shared repo; on your own repo, these were made with the wrong identity.`,
    sshDedicated: 'Pushes over SSH use a dedicated key.',
    sshDefaultNotAccount: "Pushes over SSH use your default key, not this account's key.",
    sshDefault: 'Pushes over SSH use your default key (~/.ssh/id_*).',
    httpsWrongUser: (user: string, expected: string) => `Pushes log in as ${user}, but this account's login is ${expected}.`,
    httpsOk: (user: string) => `Pushes over HTTPS log in as ${user}.`,
    httpsNone: 'No GitHub account is pinned for HTTPS pushes.',
    httpsNoneDetail: 'Git Credential Manager will use its default account, or ask if it has several.',
    noRemote: 'This repo has no "origin" remote.',
    signed: 'Commits are signed.',
    signingOff: "This account signs its commits, but they won't be signed in this repo."
  },

  settings: {
    appearance: 'Appearance',
    theme: 'Theme',
    dark: 'Dark',
    light: 'Light',
    matchWindows: 'Match Windows',
    language: 'Language',
    windowsLanguage: 'Windows language',
    startup: 'Startup',
    startWithWindows: 'Start Switchly with Windows, in the tray',
    guardTitle: 'Commit guard',
    guardToggle: 'Refuse commits made with the wrong account',
    guardHint:
      "Git refuses a commit whose email isn't the one of the account that owns the repository's folder, for example a repo overriding user.email. Each repository's own hooks keep running.",
    guardSkip: 'To skip it once: {command}',
    gcmTitle: 'Git Credential Manager',
    gcmHint: "GitHub logins stored in Git Credential Manager. GitLab and Bitbucket logins show in each account's Connections tab.",
    gcmNone: 'No GitHub account yet.',
    addGithub: 'Add a GitHub account',
    waitingWindow: 'Waiting for the sign-in window…',
    ghTitle: 'GitHub CLI',
    ghHint: 'Switching the global account also switches gh, when gh is logged in to that user.',
    ghActive: 'Active account: {user}',
    ghNotLoggedIn: 'not logged in',
    ghMissing: "gh isn't installed. Everything else works without it.",
    changesTitle: 'What Switchly changes',
    changesGitconfig: '{file}: the global name, email, SSH command and GitHub login, plus one {includeIf} entry per folder.',
    changesSwitchly: '{file}: one config file per account.',
    changesHooks: "{file}: the commit guard's hooks, used through the global {hooksPath} while the guard is on.",
    changesKeys: "{file}: keys you create here. Deleting an account never deletes its key."
  },

  gh: {
    notSignedIn: (user: string) =>
      `Git switched to ${user}. Only the GitHub CLI (gh) didn't: it isn't signed in as ${user} yet.`,
    signIn: (user: string) => `Sign gh in as ${user}`,
    starting: 'Getting a sign-in code from GitHub…',
    enterCode: (user: string) => `GitHub opened in your browser. Signed in there as ${user}, enter this code:`,
    openPage: 'Open the page again',
    waiting: 'Waiting for you to confirm on GitHub…',
    done: (user: string) => `gh is signed in as ${user}. It will follow your switches from now on.`
  },

  updates: {
    title: 'Updates',
    version: (v: string) => `Switchly ${v}`,
    check: 'Check for updates',
    upToDate: "You're up to date.",
    available: (v: string) => `Switchly ${v} is available.`,
    install: 'Update and restart',
    installing: 'Updating…',
    devNote: 'Updates are off in development builds.'
  },

  popup: {
    globalAccount: 'Global account',
    noGlobal: 'No global identity set.',
    noAccounts: 'No accounts yet. Open Switchly to add one.',
    switchTo: 'Switch to',
    open: 'Open Switchly',
    folderCount
  }
}

export type Messages = typeof en
