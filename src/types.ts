import type { HostId } from './hosts'

// Mirrors the serde types in src-tauri/src/model.rs (camelCase on the wire).

export interface Account {
  id: string
  // Shown in the UI, e.g. "Personal" or "Client A".
  label: string
  // Commit identity (user.name / user.email).
  name: string
  email: string
  // The site the account lives on.
  host: HostId
  // The login on that site: picks the Git Credential Manager login for HTTPS
  // (and the gh CLI account on GitHub). Empty when not set.
  username: string
  // Private SSH key used for this account's pushes, or null for the default.
  sshKeyPath: string | null
  // Sign commits and tags with the SSH key (needs sshKeyPath).
  signCommits: boolean
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
  // Whether the commit guard hook is installed.
  guard: boolean
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
  // commit.gpgsign as the repo resolves it.
  signing: ConfigValue | null
  credentialUser: string | null
  remoteUrl: string | null
  // The site the remote points at, when it's one Switchly knows.
  remoteHost: HostId | null
  recentEmails: EmailCount[]
}

export interface SshTest {
  ok: boolean
  // The login the key authenticates as, when it worked.
  username: string | null
  message: string
}
