import { useState } from 'react'
import { useAppState } from './api'
import { Avatar, Notice } from './components'
import { AccountsView } from './views/AccountsView'
import { DiagnoseView } from './views/DiagnoseView'
import { RulesView } from './views/RulesView'
import { SettingsView } from './views/SettingsView'

const PAGES = [
  { id: 'accounts', label: 'Accounts' },
  { id: 'rules', label: 'Folder rules' },
  { id: 'diagnose', label: 'Check a repo' },
  { id: 'settings', label: 'Settings' }
] as const

type PageId = (typeof PAGES)[number]['id']

export function MainApp() {
  const { state, error } = useAppState()
  const [page, setPage] = useState<PageId>('accounts')
  const global = state?.accounts.find((a) => a.id === state.global.accountId)

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Switchly</div>
        {PAGES.map((p) => (
          <button key={p.id} className={`nav-item ${page === p.id ? 'is-active' : ''}`} onClick={() => setPage(p.id)}>
            {p.label}
          </button>
        ))}
        <div className="sidebar-footer">
          <span className="sidebar-caption">Global account</span>
          {global ? (
            <span className="sidebar-account">
              <Avatar account={global} size={22} />
              {global.label}
            </span>
          ) : (
            <span className="sidebar-account muted">{state?.global.email ?? 'not set'}</span>
          )}
        </div>
      </nav>
      <main className="content">
        {error && <Notice kind="error">{error}</Notice>}
        {state && page === 'accounts' && <AccountsView state={state} />}
        {state && page === 'rules' && <RulesView state={state} />}
        {state && page === 'diagnose' && <DiagnoseView state={state} />}
        {state && page === 'settings' && <SettingsView state={state} />}
      </main>
    </div>
  )
}
