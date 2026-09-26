import { open } from '@tauri-apps/plugin-dialog'
import { useState } from 'react'
import { api, errorMessage } from '../api'
import { Avatar, EmptyState, Notice, Section } from '../components'
import { normalizeFolder, validateRules } from '../rules'
import type { AppState, Rule } from '../types'

export function RulesView({ state }: { state: AppState }) {
  const [error, setError] = useState<string | null>(null)
  const problems = validateRules(state.rules, state.accounts)

  async function save(rules: Rule[]): Promise<void> {
    try {
      await api.setRules(rules)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function addFolder(): Promise<void> {
    const folder = await open({ directory: true, title: 'Choose a folder of repositories' })
    if (typeof folder !== 'string') return
    const normalized = normalizeFolder(folder)
    if (state.rules.some((r) => r.folder.toLowerCase() === normalized.toLowerCase())) {
      setError(`${normalized} already has a rule.`)
      return
    }
    const accountId = state.global.accountId ?? state.accounts[0].id
    await save([...state.rules, { folder: normalized, accountId }])
  }

  const sorted = [...state.rules].sort((a, b) => a.folder.localeCompare(b.folder))

  return (
    <div className="page">
      <Section
        title="Folder rules"
        hint="Every repository inside a folder uses that folder's account: commit name and email, SSH key and HTTPS login. When folders are nested, the deepest one wins. Outside every folder, the global account applies."
      >
        {state.accounts.length === 0 ? (
          <EmptyState title="Add an account first." />
        ) : sorted.length === 0 ? (
          <EmptyState title="No rules yet.">
            <p className="hint">For example: C:/Dev/Work → your work account, C:/Dev/Perso → your personal one.</p>
          </EmptyState>
        ) : (
          <div className="rules">
            {sorted.map((rule) => {
              const account = state.accounts.find((a) => a.id === rule.accountId)
              return (
                <div className="rule" key={rule.folder}>
                  <code className="rule-folder" title={rule.folder}>
                    {rule.folder}
                  </code>
                  <span className="rule-arrow">→</span>
                  <span className="rule-account">
                    {account && <Avatar account={account} size={22} />}
                    <select
                      value={rule.accountId}
                      onChange={(e) =>
                        save(state.rules.map((r) => (r.folder === rule.folder ? { ...r, accountId: e.target.value } : r)))
                      }
                    >
                      {state.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button
                    className="btn btn-small btn-danger-ghost"
                    aria-label={`Remove the rule for ${rule.folder}`}
                    onClick={() => save(state.rules.filter((r) => r.folder !== rule.folder))}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {state.accounts.length > 0 && (
          <div className="actions">
            <button className="btn btn-primary" onClick={addFolder}>
              + Add a folder
            </button>
          </div>
        )}
        {problems.map((p) => (
          <Notice kind="warn" key={p}>
            {p}
          </Notice>
        ))}
        {error && <Notice kind="error">{error}</Notice>}
      </Section>
      <p className="hint footnote">
        Switchly writes these as <code>includeIf "gitdir/i:…"</code> entries in <code>~/.gitconfig</code>, pointing at one
        file per account in <code>~/.switchly/</code>. They keep working even when Switchly isn't running.
      </p>
    </div>
  )
}
