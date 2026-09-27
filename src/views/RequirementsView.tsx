import { openUrl } from '@tauri-apps/plugin-opener'
import { CheckCircle2, Download, ExternalLink, RefreshCw, XCircle } from 'lucide-react'
import { useState } from 'react'
import { api, errorMessage } from '../api'
import { Notice, Section } from '../components'
import { useT } from '../i18n'
import type { Requirements } from '../types'

type Tool = 'git' | 'gcm' | 'ssh' | 'gh'

const DOWNLOAD: Partial<Record<Tool, string>> = {
  git: 'https://git-scm.com/download/win',
  gh: 'https://cli.github.com'
}

// The tools Switchly relies on, with a way to install the missing ones.
// `blocking`: shown instead of the app while Git is missing.
export function RequirementsView({
  req,
  onChange,
  blocking = false
}: {
  req: Requirements
  onChange: (r: Requirements) => void
  blocking?: boolean
}) {
  const t = useT()
  const [busy, setBusy] = useState<Tool | 'check' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function recheck(): Promise<void> {
    setBusy('check')
    try {
      onChange(await api.requirements())
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  async function install(tool: 'git' | 'gh'): Promise<void> {
    setBusy(tool)
    setError(null)
    try {
      onChange(await api.installTool(tool))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const rows: { tool: Tool; ok: boolean; required: boolean }[] = [
    { tool: 'git', ok: req.git, required: true },
    { tool: 'gcm', ok: req.gcm, required: true },
    { tool: 'ssh', ok: req.ssh, required: false },
    { tool: 'gh', ok: req.gh, required: false }
  ]

  return (
    <div className="page">
      <Section title={t.requirements.title} hint={blocking ? t.requirements.blockingHint : t.requirements.hint}>
        <div className="req-list">
          {rows.map(({ tool, ok, required }) => {
            const installable = (tool === 'git' || tool === 'gh') && req.winget
            return (
              <div className="req-row" key={tool}>
                {ok ? (
                  <CheckCircle2 className="req-ok" size={20} aria-hidden="true" />
                ) : (
                  <XCircle className={required ? 'req-missing' : 'req-optional'} size={20} aria-hidden="true" />
                )}
                <div className="req-text">
                  <span className="req-name">
                    {t.requirements.names[tool]}
                    {!required && <span className="req-tag">{t.requirements.optional}</span>}
                  </span>
                  <span className="hint">{ok ? t.requirements.installed : t.requirements.missing[tool]}</span>
                </div>
                {!ok && installable && (
                  <button
                    className={`btn btn-small ${required ? 'btn-primary' : ''}`}
                    disabled={busy !== null}
                    onClick={() => install(tool as 'git' | 'gh')}
                  >
                    <Download size={14} aria-hidden="true" />
                    {busy === tool ? t.requirements.installing : t.requirements.install}
                  </button>
                )}
                {!ok && !installable && DOWNLOAD[tool] && (
                  <button className="btn btn-small" onClick={() => openUrl(DOWNLOAD[tool] as string)}>
                    <ExternalLink size={14} aria-hidden="true" />
                    {t.requirements.download}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {busy === 'git' || busy === 'gh' ? <p className="hint">{t.requirements.adminPrompt}</p> : null}
        <div className="actions">
          <button className="btn btn-small" disabled={busy !== null} onClick={recheck}>
            <RefreshCw size={14} aria-hidden="true" />
            {busy === 'check' ? t.common.checking : t.requirements.recheck}
          </button>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
      </Section>
    </div>
  )
}
