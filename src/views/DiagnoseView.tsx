import { open } from '@tauri-apps/plugin-dialog'
import { FolderSearch, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { api, errorMessage } from '../api'
import { Avatar, Notice, Section } from '../components'
import { diagnose } from '../diagnose'
import type { AppState, ConfigValue, RepoFacts } from '../types'

// Turns git's "file:C:/Users/me/.switchly/x.gitconfig" into something readable.
function describeOrigin(value: ConfigValue | null, state: AppState): string {
  if (!value) return ''
  const origin = value.origin.replace(/^file:/, '')
  const managed = origin.match(/\.switchly\/([^/]+)\.gitconfig$/i)
  if (managed) {
    const account = state.accounts.find((a) => a.id === managed[1])
    return `folder rule (${account?.label ?? 'deleted account'})`
  }
  if (value.scope === 'local') return 'this repo (.git/config)'
  if (value.scope === 'global') return 'global (~/.gitconfig)'
  return `${value.scope}: ${origin}`
}

export function DiagnoseView({ state }: { state: AppState }) {
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
    const folder = await open({ directory: true, title: 'Choose a repository' })
    if (typeof folder === 'string') await check(folder)
  }

  const result = facts && path ? diagnose(facts, path, state.accounts, state.rules) : null

  return (
    <div className="page">
      <Section
        title="Check a repository"
        hint="See which identity a repository's commits and pushes will use, and why."
      >
        <div className="actions">
          <button className="btn btn-primary" disabled={busy} onClick={pick}>
            <FolderSearch size={15} aria-hidden="true" />
            {busy ? 'Checking…' : 'Choose a repository…'}
          </button>
          {path && (
            <button className="btn" disabled={busy} onClick={() => check(path)}>
              <RefreshCw size={15} aria-hidden="true" />
              Check again
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
            <Section title="Details">
              <table className="details">
                <tbody>
                  <DetailRow label="Name" value={facts.name?.value} source={describeOrigin(facts.name, state)} />
                  <DetailRow label="Email" value={facts.email?.value} source={describeOrigin(facts.email, state)} />
                  <DetailRow
                    label="SSH command"
                    value={facts.sshCommand?.value ?? 'default (~/.ssh/id_*)'}
                    source={describeOrigin(facts.sshCommand, state)}
                  />
                  <DetailRow label="HTTPS login" value={facts.credentialUser ?? 'not pinned'} />
                  <DetailRow label="Remote" value={facts.remoteUrl ?? 'none'} />
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
  return (
    <tr>
      <th>{label}</th>
      <td>
        <code>{value ?? 'not set'}</code>
        {source && <span className="hint"> · from {source}</span>}
      </td>
    </tr>
  )
}
