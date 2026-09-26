import { open } from '@tauri-apps/plugin-dialog'
import { FolderSearch, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api, errorMessage } from '../api'
import { Avatar, Notice, Section } from '../components'
import { diagnose } from '../diagnose'
import { useT } from '../i18n'
import type { Messages } from '../locales/en'
import type { AppState, ConfigValue, RepoFacts } from '../types'

// Turns git's "file:C:/Users/me/.switchly/x.gitconfig" into something readable.
function describeOrigin(value: ConfigValue | null, state: AppState, t: Messages): string {
  if (!value) return ''
  const origin = value.origin.replace(/^file:/, '')
  const managed = origin.match(/\.switchly\/([^/]+)\.gitconfig$/i)
  if (managed) {
    const account = state.accounts.find((a) => a.id === managed[1])
    return t.diagnose.originRule(account?.label ?? t.diagnose.deletedAccount)
  }
  if (value.scope === 'local') return t.diagnose.originLocal
  if (value.scope === 'global') return t.diagnose.originGlobal
  return `${value.scope}: ${origin}`
}

export function DiagnoseView({ state }: { state: AppState }) {
  const t = useT()
  const [path, setPath] = useState<string | null>(null)
  const [facts, setFacts] = useState<RepoFacts | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function check(target: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setFacts(await api.diagnoseRepo(target))
      setPath(target)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function pick(): Promise<void> {
    const folder = await open({ directory: true, title: t.diagnose.pickTitle })
    if (typeof folder === 'string') await check(folder)
  }

  const result = facts && path ? diagnose(facts, path, state.accounts, state.rules, t.findings) : null

  return (
    <div className="page">
      <Section title={t.diagnose.title} hint={t.diagnose.hint}>
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={pick}>
            <FolderSearch size={15} aria-hidden="true" />
            {busy ? t.common.checking : t.diagnose.choose}
          </button>
          {path && (
            <button className="btn" disabled={busy} onClick={() => check(path)}>
              <RefreshCw size={15} aria-hidden="true" />
              {t.diagnose.again}
            </button>
          )}
        </div>
        {error && <Notice kind="error">{error}</Notice>}
      </Section>

      {result && facts && (
        <>
          <Section title={facts.topLevel ?? path ?? ''}>
            {result.account && (
              <div className="identity">
                <Avatar account={result.account} size={40} />
                <div>
                  <div className="identity-label">{result.account.label}</div>
                  <div className="hint">
                    {facts.name?.value} &lt;{facts.email?.value}&gt;
                  </div>
                </div>
              </div>
            )}
            <ul className="findings">
              {result.findings.map((f) => (
                <li key={f.title} className={`finding finding-${f.level}`}>
                  <span className="finding-icon" aria-hidden="true">
                    {f.level === 'ok' ? '✓' : f.level === 'warn' ? '!' : 'i'}
                  </span>
                  <div>
                    <div>{f.title}</div>
                    {f.detail && <div className="hint">{f.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          {facts.isRepo && (
            <Section title={t.diagnose.details}>
              <table className="details">
                <tbody>
                  <DetailRow label={t.diagnose.name} value={facts.name?.value} source={describeOrigin(facts.name, state, t)} />
                  <DetailRow label={t.diagnose.email} value={facts.email?.value} source={describeOrigin(facts.email, state, t)} />
                  <DetailRow
                    label={t.diagnose.sshCommand}
                    value={facts.sshCommand?.value ?? t.diagnose.defaultSsh}
                    source={describeOrigin(facts.sshCommand, state, t)}
                  />
                  <DetailRow
                    label={t.diagnose.signing}
                    value={facts.signing?.value}
                    source={describeOrigin(facts.signing, state, t)}
                  />
                  <DetailRow label={t.diagnose.httpsLogin} value={facts.credentialUser ?? t.diagnose.notPinned} />
                  <DetailRow label={t.diagnose.remote} value={facts.remoteUrl ?? t.diagnose.none} />
                </tbody>
              </table>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value, source }: { label: string; value?: string | null; source?: string }) {
  const t = useT()
  return (
    <tr>
      <th>{label}</th>
      <td>
        <code>{value ?? t.diagnose.notSet}</code>
        {source && <span className="hint">{t.diagnose.from(source)}</span>}
      </td>
    </tr>
  )
}
