// Mirrors the serde types in src-tauri/src/model.rs (camelCase on the wire).

export interface Account {
  id: string
  // Shown in the UI, e.g. "Personal" or "Client A".
  label: string
  // Commit identity (user.name / user.email).
  name: string
  email: string
  // GitHub login: picks the Git Credential Manager account for HTTPS and the
  // gh CLI account. Empty when the account doesn't use GitHub.
  githubUser: string
  // Private SSH key used for this account's pushes, or null for the default.
  sshKeyPath: string | null
  color: string
}

// All repos under `folder` use `accountId`.
export interface Rule {
  folder: string
  accountId: string
}

// The identity used outside every rule's folder.
export interface GlobalIdentity {
  name: string | null
  email: string | null
  // The account whose email matches, if any.
  accountId: string | null
}

export interface AppState {
  accounts: Account[]
  rules: Rule[]
  global: GlobalIdentity
  // null when the gh CLI isn't installed.
  ghUser: string | null
  ghAvailable: boolean
}

export interface ConfigValue {
  value: string
  // "local", "global", "system"...: a value from a rule's file reports "global".
  scope: string
  // Where it came from, e.g. "file:C:/Users/me/.switchly/work.gitconfig".
  origin: string
}

export interface EmailCount {
  email: string
  count: number
}

// Raw facts about a repo, gathered by the backend; findings are derived from
// them in diagnose.ts so that logic stays testable.
export interface RepoFacts {
  isRepo: boolean
  topLevel: string | null
  name: ConfigValue | null
  email: ConfigValue | null
  sshCommand: ConfigValue | null
  credentialUser: string | null
  remoteUrl: string | null
  recentEmails: EmailCount[]
}

export interface SshTest {
  ok: boolean
  // The GitHub login the key authenticates as, when it worked.
  githubUser: string | null
  message: string
}
