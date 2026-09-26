import { useEffect, useState } from 'react'
import { api, errorMessage, useAppState } from './api'
import { Avatar, Notice, shortFolder } from './components'

// The small window above the tray icon: see and switch the global account,
// and glance at which folder uses which account.
export function Popup() {
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
        <span className="popup-caption">Global account</span>
        {global ? (
          <div className="identity">
            <Avatar account={global} size={36} />
            <div>
              <div className="identity-label">{global.label}</div>
              <div className="hint">{global.email}</div>
            </div>
          </div>
        ) : (
          <div className="hint">{state.global.email ?? 'No global identity set.'}</div>
        )}
      </header>

      <div className="popup-body">
        {state.accounts.length === 0 ? (
          <p className="hint">No accounts yet. Open Switchly to add one.</p>
        ) : (
          <>
            <span className="popup-caption">Switch to</span>
            {state.accounts.map((a) => (
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
                {a.id === state.global.accountId && <span className="check">✓</span>}
              </button>
            ))}
          </>
        )}
        {message && <Notice kind={message.kind}>{message.text}</Notice>}

        {state.rules.length > 0 && (
          <>
            <span className="popup-caption">Folder rules</span>
            {state.rules.map((r) => {
              const account = state.accounts.find((a) => a.id === r.accountId)
              return (
                <div className="popup-rule" key={r.folder} title={r.folder}>
                  <span className="popup-rule-folder">{shortFolder(r.folder)}</span>
                  {account && (
                    <span className="popup-rule-account">
                      <Avatar account={account} size={16} />
                      {account.label}
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>

      <footer className="popup-footer">
        <button className="btn btn-small" onClick={() => api.openMain()}>
          Open Switchly
        </button>
      </footer>
    </div>
  )
}
