import { homeDir, join } from '@tauri-apps/api/path'
import { ask, open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Check,
  Copy,
  ExternalLink,
  FileKey,
  Folder,
  FolderPlus,
  Globe,
  KeyRound,
  LogIn,
  PlugZap,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
  X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { ACCOUNT_COLORS, Avatar, EmptyState, Notice, Section } from '../components'
import { fill, useT } from '../i18n'
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
  const t = useT()
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
    { id: 'identity', label: t.account.identity },
    { id: 'folders', label: t.account.folders(folderCount) },
    { id: 'connections', label: t.account.connections }
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
          <span className="pill-ok" title={t.account.globalPillTitle}>
            {t.account.globalPill}
          </span>
        ) : (
          <button className="btn" onClick={makeGlobal} title={t.account.makeGlobalTitle}>
            <Globe size={15} aria-hidden="true" />
            {t.account.makeGlobal}
          </button>
        )}
      </header>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <div className="tabs" role="tablist" aria-label={t.account.sections}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={`tab ${tab === tb.id ? 'is-active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
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
  const t = useT()
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
    const picked = await open({ directory: true, title: t.folders.chooseTitle(account.label) })
    if (typeof picked !== 'string') return
    const folder = normalizeFolder(picked)
    const existing = state.rules.find((r) => r.folder.toLowerCase() === folder.toLowerCase())
    if (existing?.accountId === account.id) {
      setError(t.folders.alreadyHere(folder))
      return
    }
    if (existing) {
      const other = state.accounts.find((a) => a.id === existing.accountId)
      const move = await ask(t.folders.moveBody(folder, other?.label ?? t.folders.anotherAccount, account.label), {
        title: t.folders.moveTitle,
        kind: 'warning',
        okLabel: t.folders.moveOk,
        cancelLabel: t.common.cancel
      })
      if (!move) return
      await save(state.rules.map((r) => (r === existing ? { ...r, accountId: account.id } : r)))
      return
    }
    await save([...state.rules, { folder, accountId: account.id }])
  }

  return (
    <Section title={t.folders.title}>
      <p className="hint">{fill(t.folders.intro, { label: <strong>{account.label}</strong> })}</p>
      {mine.length === 0 ? (
        <EmptyState title={t.folders.emptyTitle}>
          <p className="hint">{t.folders.emptyHint}</p>
        </EmptyState>
      ) : (
        <div className="folders">
          {mine.map((rule) => (
            <div className="folder-row" key={rule.folder}>
              <Folder size={18} aria-hidden="true" />
              <code title={rule.folder}>{rule.folder}</code>
              <button
                className="btn btn-small btn-danger-ghost"
                aria-label={t.folders.removeLabel(rule.folder)}
                onClick={() => save(state.rules.filter((r) => r.folder !== rule.folder))}
              >
                <X size={14} aria-hidden="true" />
                {t.folders.remove}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn btn-primary" onClick={addFolder}>
          <FolderPlus size={15} aria-hidden="true" />
          {t.folders.add}
        </button>
        <span className="hint">
          {fill(t.folders.outside, {
            label: <strong>{global?.label ?? state.global.email ?? t.folders.noIdentity}</strong>
          })}
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
  const t = useT()
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
    const ok = await ask(t.editor.deleteBody(initial.label), {
      title: t.editor.deleteTitle,
      kind: 'warning',
      okLabel: t.editor.deleteOk,
      cancelLabel: t.common.cancel
    })
    if (!ok) return
    try {
      await api.deleteAccount(initial.id)
      onDeleted?.()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Section title={isNew ? t.editor.newTitle : t.editor.title}>
      <div className="form">
        <label>
          <span>{t.editor.label}</span>
          <input value={draft.label} placeholder={t.editor.labelPlaceholder} onChange={(e) => set('label', e.target.value)} />
        </label>
        <label>
          <span>{t.editor.name}</span>
          <input value={draft.name} placeholder={t.editor.namePlaceholder} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          <span>{t.editor.email}</span>
          <input value={draft.email} placeholder={t.editor.emailPlaceholder} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label>
          <span>{t.editor.githubUser}</span>
          <input
            value={draft.githubUser}
            placeholder={t.editor.githubUserPlaceholder}
            onChange={(e) => set('githubUser', e.target.value)}
          />
        </label>
        <div className="field">
          <span>{t.editor.color}</span>
          <div className="swatches">
            {ACCOUNT_COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${draft.color === c ? 'is-selected' : ''}`}
                style={{ background: c }}
                aria-label={t.editor.colorLabel(c)}
                onClick={() => set('color', c)}
              />
            ))}
          </div>
        </div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="actions">
        <button className="btn btn-primary" disabled={!dirty} onClick={save}>
          {isNew ? <UserPlus size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          {isNew ? t.editor.add : t.editor.save}
        </button>
        {saved && !dirty && <span className="saved">{t.editor.saved}</span>}
        {!isNew && (
          <button className="btn btn-danger push-right" onClick={remove}>
            <Trash2 size={15} aria-hidden="true" />
            {t.editor.delete}
          </button>
        )}
      </div>
    </Section>
  )
}

function SshSection({ account }: { account: Account }) {
  const t = useT()
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
      const path = await open({ title: t.ssh.pickTitle, defaultPath: await join(await homeDir(), '.ssh') })
      if (typeof path === 'string') await api.setSshKey(account.id, path)
    })
  const testConnection = (): Promise<void> => run(async () => setTest(await api.testSsh(account.id)))

  const githubUser = account.githubUser || t.ssh.thisAccount

  return (
    <Section title={t.ssh.title} hint={t.ssh.hint}>
      <div className="key-summary" title={account.sshKeyPath ?? undefined}>
        <span className="key-label">{account.sshKeyPath ? t.ssh.key : t.ssh.uses}</span>
        <code>{account.sshKeyPath ? shortenHome(account.sshKeyPath) : t.ssh.defaultKey}</code>
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
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? t.ssh.copied : t.ssh.copy}
            </button>
            <button
              className="btn btn-small"
              title={t.ssh.addOnGithubTitle(githubUser)}
              onClick={() => openUrl('https://github.com/settings/ssh/new')}
            >
              <ExternalLink size={14} aria-hidden="true" />
              {t.ssh.addOnGithub}
            </button>
          </>
        )}
        {!account.sshKeyPath && (
          <button className="btn btn-small btn-primary" disabled={busy} onClick={generate}>
            <KeyRound size={14} aria-hidden="true" />
            {t.ssh.create}
          </button>
        )}
        <button className="btn btn-small" disabled={busy} onClick={testConnection}>
          <PlugZap size={14} aria-hidden="true" />
          {busy ? t.ssh.testing : t.ssh.test}
        </button>
      </div>
      {publicKey && <p className="hint">{t.ssh.addWhileSignedIn(githubUser)}</p>}
      <div className="link-actions">
        <button className="link-btn" disabled={busy} onClick={pickExisting}>
          <FileKey size={14} aria-hidden="true" />
          {t.ssh.useAnother}
        </button>
        {account.sshKeyPath && (
          <button className="link-btn" disabled={busy} onClick={useDefault}>
            <RotateCcw size={14} aria-hidden="true" />
            {t.ssh.useDefault}
          </button>
        )}
      </div>
      {test && (
        <Notice kind={test.ok ? (sameUser(test.githubUser, account.githubUser) ? 'ok' : 'warn') : 'error'}>
          {test.message}
          {test.ok &&
            account.githubUser &&
            !sameUser(test.githubUser, account.githubUser) &&
            t.ssh.belongsTo(test.githubUser ?? '', account.githubUser)}
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
  const t = useT()
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
    <Section title={t.https.title} hint={t.https.hint}>
      {!account.githubUser ? (
        <Notice kind="info">{t.https.noUser}</Notice>
      ) : accounts === null ? (
        <p className="hint">{t.common.checking}</p>
      ) : signedIn ? (
        <Notice kind="ok">{t.https.signedIn(account.githubUser)}</Notice>
      ) : (
        <>
          <Notice kind="warn">{t.https.notSignedIn(account.githubUser)}</Notice>
          <div className="actions">
            <button className="btn btn-small btn-primary" disabled={busy} onClick={login}>
              <LogIn size={14} aria-hidden="true" />
              {busy ? t.https.waiting : t.https.signIn(account.githubUser)}
            </button>
          </div>
          <p className="hint">{t.https.switchBrowser}</p>
        </>
      )}
      {error && <Notice kind="error">{error}</Notice>}
    </Section>
  )
}
