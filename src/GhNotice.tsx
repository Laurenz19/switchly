import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Check, Copy, ExternalLink, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage } from './api'
import { Notice } from './components'
import { useT } from './i18n'

type Step =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'code'; code: string; url: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string }

// After a switch where git followed but the gh CLI couldn't (gh keeps its own
// accounts): signs gh in to that account right here. gh's one-time code shows
// in Switchly and GitHub's page opens in the browser; no terminal.
export function GhNotice({ user }: { user: string }) {
  const t = useT()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const unlisten = listen<{ code: string; url: string }>('gh-login-code', ({ payload }) => {
      setStep({ kind: 'code', ...payload })
      void openUrl(payload.url)
    })
    return () => {
      void unlisten.then((fn) => fn())
      // Leaving mid-sign-in (e.g. switching accounts) stops gh waiting.
      void api.ghLoginCancel()
    }
  }, [])

  async function signIn(): Promise<void> {
    setStep({ kind: 'starting' })
    try {
      await api.ghLogin(user)
      setStep({ kind: 'done' })
    } catch (e) {
      setStep({ kind: 'error', message: errorMessage(e) })
    }
  }

  function cancel(): void {
    void api.ghLoginCancel()
    setStep({ kind: 'idle' })
  }

  if (step.kind === 'done') return <Notice kind="ok">{t.gh.done(user)}</Notice>

  return (
    <Notice kind="info">
      <div className="gh-notice">
        <span>{t.gh.notSignedIn(user)}</span>

        {(step.kind === 'idle' || step.kind === 'error') && (
          <button className="btn btn-small" onClick={signIn}>
            <LogIn size={14} aria-hidden="true" />
            {t.gh.signIn(user)}
          </button>
        )}

        {step.kind === 'starting' && <span className="hint">{t.gh.starting}</span>}

        {step.kind === 'code' && (
          <>
            <span className="hint">{t.gh.enterCode(user)}</span>
            <div className="gh-code-row">
              <code className="gh-code">{step.code}</code>
              <button
                className="btn btn-small"
                onClick={() => {
                  void navigator.clipboard.writeText(step.code)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied ? t.ssh.copied : t.ssh.copy}
              </button>
              <button className="btn btn-small" onClick={() => openUrl(step.url)}>
                <ExternalLink size={14} aria-hidden="true" />
                {t.gh.openPage}
              </button>
            </div>
            <span className="hint">{t.gh.waiting}</span>
            <button className="link-btn" onClick={cancel}>
              {t.common.cancel}
            </button>
          </>
        )}

        {step.kind === 'error' && <span className="gh-error">{step.message}</span>}
      </div>
    </Notice>
  )
}
