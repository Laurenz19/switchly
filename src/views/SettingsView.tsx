import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { Notice, Section } from '../components'
import type { AppState } from '../types'

export function SettingsView({ state }: { state: AppState }) {
  const [autostart, setAutostart] = useState<boolean | null>(null)
  const [gcm, setGcm] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshGcm = (): void => {
    api.gcmAccounts().then(setGcm, (e) => setError(errorMessage(e)))
  }

  useEffect(() => {
    isEnabled().then(setAutostart, () => setAutostart(false))
    refreshGcm()
  }, [])

  async function toggleAutostart(): Promise<void> {
    try {
      if (autostart) await disable()
      else await enable()
      setAutostart(await isEnabled())
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function addGcmAccount(): Promise<void> {
    setBusy(true)
    try {
      await api.gcmLogin()
      refreshGcm()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Section title="Startup">
        <label className="toggle-row">
          <input type="checkbox" checked={!!autostart} disabled={autostart === null} onChange={toggleAutostart} />
          <span>Start Switchly with Windows, in the tray</span>
        </label>
      </Section>

      <Section
        title="Git Credential Manager"
        hint="The GitHub accounts git can push with over HTTPS. Each folder rule picks one of them."
      >
        {gcm === null ? (
          <p className="hint">Checking…</p>
        ) : gcm.length === 0 ? (
          <Notice kind="info">No GitHub account yet.</Notice>
        ) : (
          <ul className="plain-list">
            {gcm.map((user) => (
              <li key={user}>
                <code>{user}</code>
              </li>
            ))}
          </ul>
        )}
        <div className="actions">
          <button className="btn" disabled={busy} onClick={addGcmAccount}>
            <UserPlus size={15} aria-hidden="true" />
            {busy ? 'Waiting for the sign-in window…' : 'Add a GitHub account'}
          </button>
        </div>
      </Section>

      <Section title="GitHub CLI" hint="Switching the global account also switches gh, when gh is logged in to that user.">
        {state.ghAvailable ? (
          <p>
            Active account: <code>{state.ghUser ?? 'not logged in'}</code>
          </p>
        ) : (
          <Notice kind="info">gh isn't installed. Everything else works without it.</Notice>
        )}
      </Section>

      <Section title="What Switchly changes">
        <ul className="plain-list">
          <li>
            <code>~/.gitconfig</code>: the global name, email, SSH command and GitHub login, plus one{' '}
            <code>includeIf</code> entry per folder rule.
          </li>
          <li>
            <code>~/.switchly/</code>: one config file per account.
          </li>
          <li>
            <code>~/.ssh/id_ed25519_switchly_*</code>: keys you create here. Deleting an account never deletes its key.
          </li>
        </ul>
      </Section>

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  )
}
