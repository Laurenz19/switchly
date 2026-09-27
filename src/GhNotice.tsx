import { Terminal } from 'lucide-react'
import { useState } from 'react'
import { api, errorMessage } from './api'
import { Notice } from './components'
import { useT } from './i18n'

// After a switch where git followed but the gh CLI couldn't (gh keeps its own
// accounts): a neutral note, and a button that opens `gh auth login`.
export function GhNotice({ user }: { user: string }) {
  const t = useT()
  const [opened, setOpened] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setUp(): Promise<void> {
    try {
      await api.ghLogin()
      setOpened(true)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Notice kind="info">
      <div className="gh-notice">
        <span>{t.gh.notSignedIn(user)}</span>
        <button className="btn btn-small" onClick={setUp}>
          <Terminal size={14} aria-hidden="true" />
          {t.gh.setUp(user)}
        </button>
        <span className="hint">{opened ? t.gh.opened : t.gh.hint}</span>
        {error && <span>{error}</span>}
      </div>
    </Notice>
  )
}
