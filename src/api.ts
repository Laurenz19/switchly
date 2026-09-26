// Typed wrappers over the Rust commands in src-tauri/src/commands.rs.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useState } from 'react'
import type { Account, AppState, RepoFacts, Rule, SshTest } from './types'

export const api = {
  getState: () => invoke<AppState>('get_state'),
  saveAccount: (account: Account) => invoke<Account>('save_account', { account }),
  deleteAccount: (id: string) => invoke<void>('delete_account', { id }),
  setRules: (rules: Rule[]) => invoke<void>('set_rules', { rules }),
  // Resolves to a warning when git switched but the gh CLI couldn't.
  switchGlobal: (id: string) => invoke<string | null>('switch_global', { id }),
  generateSshKey: (id: string) => invoke<string>('generate_ssh_key', { id }),
  setSshKey: (id: string, path: string | null) => invoke<void>('set_ssh_key', { id, path }),
  publicKey: (id: string) => invoke<string | null>('public_key', { id }),
  testSsh: (id: string) => invoke<SshTest>('test_ssh', { id }),
  gcmAccounts: () => invoke<string[]>('gcm_accounts'),
  // Whether Git Credential Manager holds the account's HTTPS login.
  credentialStatus: (id: string) => invoke<boolean>('credential_status', { id }),
  credentialLogin: (id: string) => invoke<void>('credential_login', { id }),
  gcmLogin: () => invoke<void>('gcm_login'),
  diagnoseRepo: (path: string) => invoke<RepoFacts>('diagnose_repo', { path }),
  openMain: () => invoke<void>('open_main'),
  hidePopup: () => invoke<void>('hide_popup')
}

export function errorMessage(err: unknown): string {
  return typeof err === 'string' ? err : err instanceof Error ? err.message : String(err)
}

// The app state, kept in sync with every change made from either window or
// the tray menu (the backend emits "state-changed").
export function useAppState(): { state: AppState | null; error: string | null; reload: () => void } {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    api.getState().then(
      (s) => {
        setState(s)
        setError(null)
      },
      (e) => setError(errorMessage(e))
    )
  }, [])

  useEffect(() => {
    reload()
    const unlisten = listen<AppState>('state-changed', (event) => setState(event.payload))
    // Git config can change outside Switchly: re-read when a window regains focus.
    window.addEventListener('focus', reload)
    return () => {
      void unlisten.then((fn) => fn())
      window.removeEventListener('focus', reload)
    }
  }, [reload])

  return { state, error, reload }
}
