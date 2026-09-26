import { useState } from 'react'
import { useAppState } from './api'
import { Avatar, Notice } from './components'
import { AccountEditor, AccountPage, blankAccount } from './views/AccountPage'
import { DiagnoseView } from './views/DiagnoseView'
import { SettingsView } from './views/SettingsView'

type Route = { kind: 'account'; id: string } | { kind: 'new' } | { kind: 'diagnose' } | { kind: 'settings' }

// Accounts are the main navigation: each one owns its identity, folders and
// connections (see AccountPage). Tools sit at the bottom of the sidebar.
export function MainApp() {
  const { state, error } = useAppState()
  const [route, setRoute] = useState<Route | null>(null)

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
        <span className="sidebar-caption">Accounts</span>
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
                <span className="list-title">{a.label}</span>
                <span className="list-sub">{folders === 1 ? '1 folder' : `${folders} folders`}</span>
              </span>
              {state.global.accountId === a.id && <span className="badge">Global</span>}
            </button>
          )
        })}
        <button className={`add-account ${current.kind === 'new' ? 'is-selected' : ''}`} onClick={() => setRoute({ kind: 'new' })}>
          + Add account
        </button>

        <div className="sidebar-tools">
          <button
            className={`nav-item ${current.kind === 'diagnose' ? 'is-active' : ''}`}
            onClick={() => setRoute({ kind: 'diagnose' })}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Check a repo
          </button>
          <button
            className={`nav-item ${current.kind === 'settings' ? 'is-active' : ''}`}
            onClick={() => setRoute({ kind: 'settings' })}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
            </svg>
            Settings
          </button>
        </div>
      </nav>

      <main className="content">
        {error && <Notice kind="error">{error}</Notice>}
        {state && account && (
          <AccountPage key={account.id} account={account} state={state} onDeleted={() => setRoute(null)} />
        )}
        {state && current.kind === 'new' && (
          <div className="page">
            <AccountEditor
              key="new"
              initial={blankAccount()}
              onSaved={(a) => setRoute({ kind: 'account', id: a.id })}
            />
          </div>
        )}
        {state && current.kind === 'diagnose' && <DiagnoseView state={state} />}
        {state && current.kind === 'settings' && <SettingsView state={state} />}
      </main>
    </div>
  )
}
