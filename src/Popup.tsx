import { AppWindow } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage, useAppState } from './api'
import { Avatar, Notice } from './components'
import { useT } from './i18n'

// The small window above the tray icon: see and switch the global account,
// with each account's folder count.
export function Popup() {
  const t = useT()
  const { state } = useAppState()
  const [message, setMessage] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') void api.hidePopup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!state) return null
  const global = state.accounts.find((a) => a.id === state.global.accountId)

  async function switchTo(id: string): Promise<void> {
    try {
      const warning = await api.switchGlobal(id)
      setMessage(warning ? { kind: 'warn', text: warning } : null)
    } catch (e) {
      setMessage({ kind: 'error', text: errorMessage(e) })
    }
  }

  return (
    <div className="popup">
      <header className="popup-header">
        <span className="popup-caption">{t.popup.globalAccount}</span>
        {global ? (
          <div className="identity">
            <Avatar account={global} size={36} />
            <div>
              <div className="identity-label">{global.label}</div>
              <div className="hint">{global.email}</div>
            </div>
          </div>
        ) : (
          <div className="hint">{state.global.email ?? t.popup.noGlobal}</div>
        )}
      </header>

      <div className="popup-body">
        {state.accounts.length === 0 ? (
          <p className="hint">{t.popup.noAccounts}</p>
        ) : (
          <>
            <span className="popup-caption">{t.popup.switchTo}</span>
            {state.accounts.map((a) => {
              // Only the count: the folders themselves live in the main
              // window's Folders tab, so the popup stays short.
              const folders = state.rules.filter((r) => r.accountId === a.id).map((r) => r.folder)
              return (
                <button
                  key={a.id}
                  className={`popup-account ${a.id === state.global.accountId ? 'is-active' : ''}`}
                  onClick={() => switchTo(a.id)}
                >
                  <Avatar account={a} size={26} />
                  <span className="list-text">
                    <span className="list-title">{a.label}</span>
                    <span className="list-sub">{a.email}</span>
                  </span>
                  <span className="popup-folders" title={folders.join('\n') || undefined}>
                    {t.popup.folderCount(folders.length)}
                  </span>
                  <span className="check" aria-hidden={a.id !== state.global.accountId}>
                    {a.id === state.global.accountId ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </>
        )}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}
      </div>

      <footer className="popup-footer">
        <button className="btn btn-small" onClick={() => api.openMain()}>
          <AppWindow size={14} aria-hidden="true" />
          {t.popup.open}
        </button>
      </footer>
    </div>
  )
}
