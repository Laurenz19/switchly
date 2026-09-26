import { AppWindow } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api, errorMessage, useAppState } from './api'
import { Avatar, HostBadge, Notice } from './components'
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

  // Fit the window to the content: header + the whole list + footer, even
  // when the list is taller than the window (the backend caps the height and
  // the list then scrolls). Re-measured whenever the content changes.
  const rootRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = (): void => {
      const part = (cls: string): HTMLElement | null => root.querySelector(`.${cls}`)
      const header = part('popup-header')
      const body = part('popup-body')
      const footer = part('popup-footer')
      if (!header || !body || !footer) return
      const borders = root.offsetHeight - root.clientHeight
      void api.resizePopup(Math.ceil(header.offsetHeight + body.scrollHeight + footer.offsetHeight + borders))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [state, message])

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
    <div className="popup" ref={rootRef}>
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
                    <span className="list-title">
                      <span className="list-title-text">{a.label}</span>
                      <HostBadge host={a.host} />
                    </span>
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
