import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { Languages, Monitor, Moon, Sun, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, errorMessage } from '../api'
import { Notice, Section } from '../components'
import { fill, LANGUAGES, type LangPref, messagesFor, setLangPref, useLangPref, useT } from '../i18n'
import { type ThemePref, useThemePref } from '../theme'
import type { AppState } from '../types'

export function SettingsView({ state }: { state: AppState }) {
  const t = useT()
  const lang = useLangPref()
  const [theme, setTheme] = useThemePref()
  const [autostart, setAutostart] = useState<boolean | null>(null)
  const [gcm, setGcm] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const themes: { id: ThemePref; label: string; Icon: typeof Moon }[] = [
    { id: 'dark', label: t.settings.dark, Icon: Moon },
    { id: 'light', label: t.settings.light, Icon: Sun },
    { id: 'system', label: t.settings.matchWindows, Icon: Monitor }
  ]
  // Each language is named in itself, so it's findable whatever is active.
  const languages: { id: LangPref; label: string }[] = [
    { id: 'system', label: t.settings.windowsLanguage },
    ...LANGUAGES.map((l) => ({ id: l, label: messagesFor(l).languageName }))
  ]

  const refreshGcm = (): void => {
    api.gcmAccounts().then(setGcm, (e) => setError(errorMessage(e)))
  }

  useEffect(() => {
    isEnabled().then(setAutostart, () => setAutostart(false))
    refreshGcm()
  }, [])

  async function toggleAutostart(): Promise<void> {
    try {
      if (autostart) await disable()
      else await enable()
      setAutostart(await isEnabled())
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function addGcmAccount(): Promise<void> {
    setBusy(true)
    try {
      await api.gcmLogin()
      refreshGcm()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Section title={t.settings.appearance}>
        <div className="setting-row">
          <span className="setting-label">{t.settings.theme}</span>
          <div className="segmented" role="radiogroup" aria-label={t.settings.theme}>
            {themes.map(({ id, label, Icon }) => (
              <button
                key={id}
                role="radio"
                aria-checked={theme === id}
                className={`segment ${theme === id ? 'is-active' : ''}`}
                onClick={() => setTheme(id)}
              >
                <Icon size={15} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span className="setting-label">{t.settings.language}</span>
          <div className="segmented" role="radiogroup" aria-label={t.settings.language}>
            {languages.map(({ id, label }) => (
              <button
                key={id}
                role="radio"
                aria-checked={lang === id}
                className={`segment ${lang === id ? 'is-active' : ''}`}
                onClick={() => setLangPref(id)}
              >
                {id === 'system' && <Languages size={15} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t.settings.startup}>
        <label className="toggle-row">
          <input type="checkbox" checked={!!autostart} disabled={autostart === null} onChange={toggleAutostart} />
          <span>{t.settings.startWithWindows}</span>
        </label>
      </Section>

      <Section title={t.settings.gcmTitle} hint={t.settings.gcmHint}>
        {gcm === null ? (
          <p className="hint">{t.common.checking}</p>
        ) : gcm.length === 0 ? (
          <Notice kind="info">{t.settings.gcmNone}</Notice>
        ) : (
          <ul className="plain-list">
            {gcm.map((user) => (
              <li key={user}>
                <code>{user}</code>
              </li>
            ))}
          </ul>
        )}
        <div className="actions">
          <button className="btn" disabled={busy} onClick={addGcmAccount}>
            <UserPlus size={15} aria-hidden="true" />
            {busy ? t.settings.waitingWindow : t.settings.addGithub}
          </button>
        </div>
      </Section>

      <Section title={t.settings.ghTitle} hint={t.settings.ghHint}>
        {state.ghAvailable ? (
          <p>{fill(t.settings.ghActive, { user: <code>{state.ghUser ?? t.settings.ghNotLoggedIn}</code> })}</p>
        ) : (
          <Notice kind="info">{t.settings.ghMissing}</Notice>
        )}
      </Section>

      <Section title={t.settings.changesTitle}>
        <ul className="plain-list">
          <li>{fill(t.settings.changesGitconfig, { file: <code>~/.gitconfig</code>, includeIf: <code>includeIf</code> })}</li>
          <li>{fill(t.settings.changesSwitchly, { file: <code>~/.switchly/</code> })}</li>
          <li>{fill(t.settings.changesKeys, { file: <code>~/.ssh/id_ed25519_switchly_*</code> })}</li>
        </ul>
      </Section>

      {error && <Notice kind="error">{error}</Notice>}
    </div>
  )
}
