import { homeDir, join } from '@tauri-apps/api/path'
import { ask, open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { ACCOUNT_COLORS, Avatar, EmptyState, Notice, Section } from '../components'
import { normalizeFolder } from '../rules'
import type { Account, AppState, Rule, SshTest } from '../types'

export const blankAccount = (): Account => ({
  id: '',
  label: '',
  name: '',
  email: '',
  githubUser: '',
  sshKeyPath: null,
  color: ACCOUNT_COLORS[0]
})

type Tab = 'identity' | 'folders' | 'connections'

// One account: its header (with the global switch) and three tabs, so
// nothing needs scrolling. Keyed by account id in MainApp, so switching
// accounts starts clean.
export function AccountPage({ account, state, onDeleted }: { account: Account; state: AppState; onDeleted: () => void }) {
  const [tab, setTab] = useState<Tab>('folders')
  const [message, setMessage] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null)
  const isGlobal = state.global.accountId === account.id
  const folderCount = state.rules.filter((r) => r.accountId === account.id).length

  async function makeGlobal(): Promise<void> {
    try {
      const warning = await api.switchGlobal(account.id)
      setMessage(warning ? { kind: 'warn', text: warning } : null)
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'identity', label: 'Identity' },
    { id: 'folders', label: `Folders (${folderCount})` },
    { id: 'connections', label: 'Connections' }
  ]

  return (
    <div className="account-page">
      <header className="account-header">
        <Avatar account={account} size={48} />
        <div className="account-heading">
          <h2>{account.label}</h2>
          <p className="hint">
            {account.name} · {account.email}
          </p>
        </div>
        {isGlobal ? (
          <span className="pill-ok" title="Used in every repo that no folder covers">
            ✓ Global account
          </span>
        ) : (
          <button className="btn" onClick={makeGlobal} title="Use this account in every repo that no folder covers">
            Make global
          </button>
        )}
      </header>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <div className="tabs" role="tablist" aria-label="Account sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'identity' && <AccountEditor initial={account} onDeleted={onDeleted} />}
      {tab === 'folders' && <FoldersTab account={account} state={state} />}
      {tab === 'connections' && (
        <div className="connections">
          <HttpsSection account={account} />
          <SshSection account={account} />
        </div>
      )}
    </div>
  )
}

// The folder rules pointing at this account.
function FoldersTab({ account, state }: { account: Account; state: AppState }) {
  const [error, setError] = useState<string | null>(null)
  const mine = state.rules.filter((r) => r.accountId === account.id).sort((a, b) => a.folder.localeCompare(b.folder))
  const global = state.accounts.find((a) => a.id === state.global.accountId)

  async function save(rules: Rule[]): Promise<void> {
    try {
      await api.setRules(rules)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function addFolder(): Promise<void> {
    const picked = await open({ directory: true, title: `Choose a folder for ${account.label}` })
    if (typeof picked !== 'string') return
    const folder = normalizeFolder(picked)
    const existing = state.rules.find((r) => r.folder.toLowerCase() === folder.toLowerCase())
    if (existing?.accountId === account.id) {
      setError(`${folder} is already in this account's folders.`)
      return
    }
    if (existing) {
      const other = state.accounts.find((a) => a.id === existing.accountId)
      const move = await ask(`${folder} currently uses ${other?.label ?? 'another account'}.\n\nUse ${account.label} for it instead?`, {
        title: 'Move folder',
        kind: 'warning',
        okLabel: 'Move it',
        cancelLabel: 'Cancel'
      })
      if (!move) return
      await save(state.rules.map((r) => (r === existing ? { ...r, accountId: account.id } : r)))
      return
    }
    await save([...state.rules, { folder, accountId: account.id }])
  }

  return (
    <Section title="Folders">
      <p className="hint">
        Every repository inside these folders commits and pushes as <strong>{account.label}</strong>. When folders are nested,
        the deepest one wins.
      </p>
      {mine.length === 0 ? (
        <EmptyState title="No folders yet">
          <p className="hint">This account is only used while it's the global one.</p>
        </EmptyState>
      ) : (
        <div className="folders">
          {mine.map((rule) => (
            <div className="folder-row" key={rule.folder}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              </svg>
              <code title={rule.folder}>{rule.folder}</code>
              <button
                className="btn btn-small btn-danger-ghost"
                aria-label={`Remove ${rule.folder}`}
                onClick={() => save(state.rules.filter((r) => r.folder !== rule.folder))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn btn-primary" onClick={addFolder}>
          + Add a folder
        </button>
        <span className="hint">
          Outside every folder: <strong>{global?.label ?? state.global.email ?? 'no identity'}</strong> (global)
        </span>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
    </Section>
  )
}

export function AccountEditor({
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
    <Section title={isNew ? 'New account' : 'Identity'}>
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

  const githubUser = account.githubUser || 'this account'

  return (
    <Section title="SSH key" hint="For git@github.com:… remotes. Each GitHub account needs its own key.">
      <div className="key-summary" title={account.sshKeyPath ?? undefined}>
        <span className="key-label">{account.sshKeyPath ? 'Key' : 'Uses'}</span>
        <code>{account.sshKeyPath ? shortenHome(account.sshKeyPath) : 'your default key (~/.ssh/id_*)'}</code>
      </div>
      {publicKey && (
        <code className="key-value" title={publicKey}>
          {publicKey}
        </code>
      )}
      <div className="actions">
        {publicKey && (
          <>
            <button
              className="btn btn-small"
              onClick={() => {
                void navigator.clipboard.writeText(publicKey)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              className="btn btn-small"
              title={`Sign in to GitHub as ${githubUser} first`}
              onClick={() => openUrl('https://github.com/settings/ssh/new')}
            >
              Add on GitHub
            </button>
          </>
        )}
        {!account.sshKeyPath && (
          <button className="btn btn-small btn-primary" disabled={busy} onClick={generate}>
            Create a key
          </button>
        )}
        <button className="btn btn-small" disabled={busy} onClick={testConnection}>
          {busy ? 'Testing…' : 'Test'}
        </button>
      </div>
      {publicKey && <p className="hint">Add it while signed in to GitHub as {githubUser}.</p>}
      <div className="link-actions">
        <button className="link-btn" disabled={busy} onClick={pickExisting}>
          Use another key…
        </button>
        {account.sshKeyPath && (
          <button className="link-btn" disabled={busy} onClick={useDefault}>
            Use the default key
          </button>
        )}
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

// "C:/Users/me/.ssh/id_x" → "~/.ssh/id_x"
function shortenHome(path: string): string {
  return path.replace(/\\/g, '/').replace(/^[A-Za-z]:\/Users\/[^/]+/, '~')
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
    <Section title="HTTPS login" hint="For https://github.com/… remotes, through Git Credential Manager.">
      {!account.githubUser ? (
        <Notice kind="info">Add a GitHub username in Identity to pin this account's login.</Notice>
      ) : accounts === null ? (
        <p className="hint">Checking…</p>
      ) : signedIn ? (
        <Notice kind="ok">Signed in as {account.githubUser}</Notice>
      ) : (
        <>
          <Notice kind="warn">Not signed in as {account.githubUser} yet</Notice>
          <div className="actions">
            <button className="btn btn-small btn-primary" disabled={busy} onClick={login}>
              {busy ? 'Waiting for sign-in…' : `Sign in as ${account.githubUser}`}
            </button>
          </div>
          <p className="hint">If your browser is signed in to another GitHub account, switch there first.</p>
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </Section>
  )
}
