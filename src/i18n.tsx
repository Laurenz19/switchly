import { invoke } from '@tauri-apps/api/core'
import { Fragment, type ReactNode, useSyncExternalStore } from 'react'
import { en, type Messages } from './locales/en'
import { fr } from './locales/fr'

// To add a language: a new locales/<code>.ts typed as Messages, plus an entry
// here and in LANGUAGE_NAMES in src-tauri/src/tray.rs (the tray menu).
const LOCALES = { en, fr } satisfies Record<string, Messages>

export type Lang = keyof typeof LOCALES
export type LangPref = Lang | 'system'
export const LANGUAGES = Object.keys(LOCALES) as Lang[]

const KEY = 'switchly.language'

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'system' || (v !== null && v in LOCALES)) return v as LangPref
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return 'system'
}

// Windows' display language, as the webview reports it; English otherwise.
function systemLang(): Lang {
  const code = navigator.language.slice(0, 2).toLowerCase()
  return code in LOCALES ? (code as Lang) : 'en'
}

export function resolveLang(pref: LangPref): Lang {
  return pref === 'system' ? systemLang() : pref
}

// One store for the whole window, kept in sync with the other window through
// the storage event (localStorage is shared by the main window and popup).
let pref = readPref()
const listeners = new Set<() => void>()

function notify(): void {
  document.documentElement.lang = resolveLang(pref)
  listeners.forEach((l) => l())
}

// The tray menu is drawn by Rust, so it's told the language too.
function syncTray(): void {
  void invoke('set_language', { lang: resolveLang(pref) }).catch(() => {})
}

window.addEventListener('storage', (e) => {
  if (e.key === KEY) {
    pref = readPref()
    notify()
  }
})

export function initLanguage(): void {
  document.documentElement.lang = resolveLang(pref)
  syncTray()
}

export function setLangPref(next: LangPref): void {
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Not persisted, but still applied to this window.
  }
  pref = next
  notify()
  syncTray()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLangPref(): LangPref {
  return useSyncExternalStore(subscribe, () => pref)
}

// The current window's messages; re-renders when the language changes.
export function useT(): Messages {
  return LOCALES[resolveLang(useLangPref())]
}

export function messagesFor(lang: Lang): Messages {
  return LOCALES[lang]
}

// Fills "{name}" placeholders with text or markup:
// fill(t.folders.outside, { label: <strong>Work</strong> })
export function fill(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{key !== undefined && key in values ? values[key] : part}</Fragment>
  })
}
