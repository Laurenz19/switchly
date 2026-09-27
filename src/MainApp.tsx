import { Search, Settings, UserPlus } from 'lucide-react'
import type { Update } from '@tauri-apps/plugin-updater'
import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppState } from './api'
import { Avatar, HostBadge, Notice } from './components'
import { useT } from './i18n'
import { findUpdate, installUpdate } from './updater'
import { AccountEditor, AccountPage, blankAccount } from './views/AccountPage'
import { DiagnoseView } from './views/DiagnoseView'
import { RequirementsView } from './views/RequirementsView'
import { SettingsView } from './views/SettingsView'
import type { Requirements } from './types'
import { api } from './api'

type Route = { kind: 'account'; id: string } | { kind: 'new' } | { kind: 'diagnose' } | { kind: 'settings' }

// Accounts are the main navigation: each one owns its identity, folders and
// connections (see AccountPage). Tools sit at the bottom of the sidebar.
export function MainApp() {
  const t = useT()
  const { state, error } = useAppState()
  const [route, setRoute] = useState<Route | null>(null)
  const [update, setUpdate] = useState<Update | null>(null)
  const [req, setReq] = useState<Requirements | null>(null)
  const gitMissing = req !== null && !req.git
  const [updating, setUpdating] = useState(false)

  // Once per launch; offline or no release yet just means no banner.
  useEffect(() => {
    findUpdate().then(setUpdate, () => setUpdate(null))
    api.requirements().then(setReq, () => setReq(null))
  }, [])

  // Until the user picks something, show the first account (or the form to
  // create one); a deleted account falls back the same way.
  const first: Route = state?.accounts[0] ? { kind: 'account', id: state.accounts[0].id } : { kind: 'new' }
  let current: Route = route ?? first
  if (current.kind === 'account' && state && !state.accounts.some((a) => a.id === (current as { id: string }).id)) current = first
  const account = current.kind === 'account' ? state?.accounts.find((a) => a.id === (current as { id: string }).id) : undefined

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Switchly</div>
        <span className="sidebar-caption">{t.nav.accounts}</span>
        {state?.accounts.map((a) => {
          const folders = state.rules.filter((r) => r.accountId === a.id).length
          const selected = current.kind === 'account' && current.id === a.id
          return (
            <button
              key={a.id}
              className={`account-nav ${selected ? 'is-selected' : ''}`}
              onClick={() => setRoute({ kind: 'account', id: a.id })}
            >
              <Avatar account={a} size={32} />
              <span className="list-text">
                <span className="list-title">
                  <span className="list-title-text">{a.label}</span>
                </span>
                <span className="list-sub account-meta">
                  <HostBadge host={a.host} />
                  {t.nav.folderCount(folders)}
                </span>
              </span>
              {state.global.accountId === a.id && <span className="badge">{t.nav.global}</span>}
            </button>
          )
        })}
        <button className={`add-account ${current.kind === 'new' ? 'is-selected' : ''}`} onClick={() => setRoute({ kind: 'new' })}>
          <UserPlus size={16} aria-hidden="true" />
          {t.nav.addAccount}
        </button>

        <div className="sidebar-tools">
          <button
            className={`nav-item ${current.kind === 'diagnose' ? 'is-active' : ''}`}
            onClick={() => setRoute({ kind: 'diagnose' })}
          >
            <Search size={17} aria-hidden="true" />
            {t.nav.checkRepo}
          </button>
          <button
            className={`nav-item ${current.kind === 'settings' ? 'is-active' : ''}`}
            onClick={() => setRoute({ kind: 'settings' })}
          >
            <Settings size={17} aria-hidden="true" />
            {t.nav.settings}
          </button>
        </div>
      </nav>

      <main className="content">
        {error && <Notice kind="error">{error}</Notice>}
        {update && (
          <div className="update-banner">
            <span>{t.updates.available(update.version)}</span>
            <button
              className="btn btn-small btn-primary"
              disabled={updating}
              onClick={() => {
                setUpdating(true)
                installUpdate(update).catch(() => setUpdating(false))
              }}
            >
              <Download size={14} aria-hidden="true" />
              {updating ? t.updates.installing : t.updates.install}
            </button>
          </div>
        )}
        {gitMissing && req && <RequirementsView req={req} onChange={setReq} blocking />}
        {!gitMissing && state && account && (
          <AccountPage key={account.id} account={account} state={state} onDeleted={() => setRoute(null)} />
        )}
        {!gitMissing && state && current.kind === 'new' && (
          <div className="page">
            <AccountEditor
              key="new"
              initial={blankAccount()}
              onSaved={(a) => setRoute({ kind: 'account', id: a.id })}
            />
          </div>
        )}
        {!gitMissing && state && current.kind === 'diagnose' && <DiagnoseView state={state} />}
        {!gitMissing && state && current.kind === 'settings' && (
          <SettingsView state={state} req={req} onReqChange={setReq} />
        )}
      </main>
    </div>
  )
}
