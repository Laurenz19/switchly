import { homeDir, join } from '@tauri-apps/api/path'
import { ask, open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { ACCOUNT_COLORS, Avatar, EmptyState, Notice, Section } from '../components'
import type { Account, AppState, SshTest } from '../types'

const blankAccount = (): Account => ({
  id: '',
  label: '',
  name: '',
  email: '',
  githubUser: '',
  sshKeyPath: null,
  color: ACCOUNT_COLORS[0]
})

export function AccountsView({ state }: { state: AppState }) {
  const [selectedId, setSelectedId] = useState<string | null>(state.accounts[0]?.id ?? null)
  const [creating, setCreating] = useState(state.accounts.length === 0)
  const selected = state.accounts.find((a) => a.id === selectedId) ?? null

  return (
    <div className="split">
      <div className="list-pane">
        {state.accounts.map((a) => (
          <button
            key={a.id}
            className={`list-item ${!creating && a.id === selectedId ? 'is-selected' : ''}`}
            onClick={() => {
              setSelectedId(a.id)
              setCreating(false)
            }}
          >
            <Avatar account={a} />
            <span className="list-text">
              <span className="list-title">
                {a.label}
                {state.global.accountId === a.id && <span className="badge">Global</span>}
              </span>
              <span className="list-sub">{a.email}</span>
            </span>
          </button>
        ))}
        <button className={`list-item list-add ${creating ? 'is-selected' : ''}`} onClick={() => setCreating(true)}>
          + Add account
        </button>
      </div>
      <div className="detail-pane">
        {creating ? (
          <AccountEditor
            key="new"
            initial={blankAccount()}
            onSaved={(a) => {
              setSelectedId(a.id)
              setCreating(false)
            }}
          />
        ) : selected ? (
          <>
            <AccountEditor key={selected.id} initial={selected} onDeleted={() => setSelectedId(null)} />
            <GlobalSection account={selected} state={state} />
            <SshSection account={selected} />
            <HttpsSection account={selected} />
          </>
        ) : (
          <EmptyState title="Pick an account, or add one." />
        )}
      </div>
    </div>
  )
}

function AccountEditor({
  initial,
  onSaved,
  onDeleted
}: {
  initial: Account
  onSaved?: (a: Account) => void
  onDeleted?: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const isNew = initial.id === ''
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const set = <K extends keyof Account>(key: K, value: Account[K]): void => {
    setDraft((d) => ({ ...d, [key]: value }))
    setSaved(false)
  }

  async function save(): Promise<void> {
    try {
      const account = await api.saveAccount(draft)
      setError(null)
      setSaved(true)
      onSaved?.(account)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function remove(): Promise<void> {
    // The dialog plugin, not window.confirm(): the webview doesn't reliably
    // show browser dialogs, which made the button look dead.
    const ok = await ask(
      `Delete "${initial.label}"?\n\nIts folder rules are removed too. Its SSH key file stays on disk, and the global git identity isn't changed.`,
      { title: 'Delete account', kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' }
    )
    if (!ok) return
    try {
      await api.deleteAccount(initial.id)
      onDeleted?.()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Section title={isNew ? 'New account' : 'Account'}>
      <div className="form">
        <label>
          <span>Label</span>
          <input value={draft.label} placeholder="Personal, Client A…" onChange={(e) => set('label', e.target.value)} />
        </label>
        <label>
          <span>Commit name</span>
          <input value={draft.name} placeholder="Jane Doe" onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          <span>Commit email</span>
          <input value={draft.email} placeholder="jane@example.com" onChange={(e) => set('email', e.target.value)} />
        </label>
        <label>
          <span>GitHub username</span>
          <input
            value={draft.githubUser}
            placeholder="Optional: used to log in for HTTPS pushes and gh"
            onChange={(e) => set('githubUser', e.target.value)}
          />
        </label>
        <div className="field">
          <span>Color</span>
          <div className="swatches">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${draft.color === c ? 'is-selected' : ''}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => set('color', c)}
              />
            ))}
          </div>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" disabled={!dirty} onClick={save}>
          {isNew ? 'Add account' : 'Save'}
        </button>
        {saved && !dirty && <span className="saved">Saved</span>}
        {!isNew && (
          <button className="btn btn-danger push-right" onClick={remove}>
            Delete account
          </button>
        )}
      </div>
    </Section>
  )
}

function GlobalSection({ account, state }: { account: Account; state: AppState }) {
  const [message, setMessage] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null)
  const isGlobal = state.global.accountId === account.id

  async function makeGlobal(): Promise<void> {
    try {
      const warning = await api.switchGlobal(account.id)
      setMessage(warning ? { kind: 'warn', text: warning } : null)
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    }
  }

  return (
    <Section
      title="Global account"
      hint="Used in every repo that no folder rule covers. Switching also switches the gh CLI when it's logged in to this GitHub user."
    >
      {isGlobal ? (
        <Notice kind="ok">This is the global account.</Notice>
      ) : (
        <button className="btn" onClick={makeGlobal}>
          Make {account.label} the global account
        </button>
      )}
      {message && <Notice kind={message.kind}>{message.text}</Notice>}
    </Section>
  )
}

function SshSection({ account }: { account: Account }) {
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [test, setTest] = useState<SshTest | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setTest(null)
    setError(null)
    api.publicKey(account.id).then(setPublicKey, (e) => {
      setPublicKey(null)
      setError(errorMessage(e))
    })
  }, [account.id, account.sshKeyPath])

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const generate = (): Promise<void> => run(async () => setPublicKey(await api.generateSshKey(account.id)))
  const useDefault = (): Promise<void> => run(() => api.setSshKey(account.id, null))
  const pickExisting = (): Promise<void> =>
    run(async () => {
      const path = await open({ title: 'Choose a private SSH key', defaultPath: await join(await homeDir(), '.ssh') })
      if (typeof path === 'string') await api.setSshKey(account.id, path)
    })
  const testConnection = (): Promise<void> => run(async () => setTest(await api.testSsh(account.id)))

  return (
    <Section
      title="SSH key"
      hint="For remotes like git@github.com:owner/repo.git. Each GitHub account needs its own key: GitHub refuses a key that's already on another account."
    >
      <p className="mono-line">{account.sshKeyPath ?? 'Default key (~/.ssh/id_*)'}</p>
      {publicKey && (
        <div className="key-box">
          <code>{publicKey}</code>
          <div className="actions">
            <button
              className="btn btn-small"
              onClick={() => {
                void navigator.clipboard.writeText(publicKey)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Copied' : 'Copy public key'}
            </button>
            <button className="btn btn-small" onClick={() => openUrl('https://github.com/settings/ssh/new')}>
              Add it on GitHub
            </button>
          </div>
          <p className="hint">Sign in to GitHub as {account.githubUser || 'this account'} before adding it.</p>
        </div>
      )}
      <div className="actions">
        {!account.sshKeyPath && (
          <button className="btn" disabled={busy} onClick={generate}>
            Create a key for this account
          </button>
        )}
        <button className="btn" disabled={busy} onClick={pickExisting}>
          Use an existing key…
        </button>
        {account.sshKeyPath && (
          <button className="btn" disabled={busy} onClick={useDefault}>
            Use the default key
          </button>
        )}
        <button className="btn" disabled={busy} onClick={testConnection}>
          {busy ? 'Working…' : 'Test connection'}
        </button>
      </div>
      {test && (
        <Notice kind={test.ok ? (sameUser(test.githubUser, account.githubUser) ? 'ok' : 'warn') : 'error'}>
          {test.message}
          {test.ok && account.githubUser && !sameUser(test.githubUser, account.githubUser) &&
            ` This key belongs to ${test.githubUser}, not ${account.githubUser}.`}
        </Notice>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </Section>
  )
}

function sameUser(a: string | null, b: string): boolean {
  return !b || (!!a && a.toLowerCase() === b.toLowerCase())
}

function HttpsSection({ account }: { account: Account }) {
  const [accounts, setAccounts] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = (): void => {
    api.gcmAccounts().then(setAccounts, (e) => setError(errorMessage(e)))
  }
  useEffect(refresh, [])

  async function login(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await api.gcmLogin()
      refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const signedIn = accounts?.some((a) => a.toLowerCase() === account.githubUser.toLowerCase()) ?? false

  return (
    <Section
      title="HTTPS login"
      hint="For remotes like https://github.com/owner/repo.git. Git Credential Manager keeps one login per GitHub account; Switchly tells it which one to use."
    >
      {!account.githubUser ? (
        <Notice kind="info">Set a GitHub username above to pin this account's HTTPS login.</Notice>
      ) : accounts === null ? (
        <p className="hint">Checking…</p>
      ) : signedIn ? (
        <Notice kind="ok">Git Credential Manager is signed in as {account.githubUser}.</Notice>
      ) : (
        <>
          <Notice kind="warn">Git Credential Manager isn't signed in as {account.githubUser} yet.</Notice>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={login}>
              {busy ? 'Waiting for the sign-in window…' : `Sign in as ${account.githubUser}`}
            </button>
          </div>
          <p className="hint">
            A GitHub sign-in window opens. If your browser is already signed in to another GitHub account, switch accounts there
            first.
          </p>
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </Section>
  )
}
