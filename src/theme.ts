import { getCurrentWindow } from '@tauri-apps/api/window'
import { useEffect, useState } from 'react'

export type ThemePref = 'dark' | 'light' | 'system'

const KEY = 'switchly.theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

// Dark unless the user picked otherwise. localStorage is shared by the main
// window and the popup (same origin), and it's a per-machine preference.
export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    // Storage unavailable: fall through to the default.
  }
  return 'dark'
}

// Sets data-theme to the effective theme ("dark" or "light"); the CSS only
// knows those two, so "system" is resolved here.
export function applyTheme(pref: ThemePref = getThemePref()): void {
  const dark = pref === 'dark' || (pref === 'system' && media.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  // The native title bar follows the window's theme, not the page's CSS.
  // null hands it back to Windows for "system".
  void getCurrentWindow()
    .setTheme(pref === 'system' ? null : dark ? 'dark' : 'light')
    .catch(() => {})
}

// Keeps this window in sync when the other window changes the setting, or
// when Windows switches between light and dark.
export function watchTheme(): void {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) applyTheme()
  })
  media.addEventListener('change', () => applyTheme())
}

export function useThemePref(): [ThemePref, (pref: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(getThemePref)

  useEffect(() => {
    const onStorage = (e: StorageEvent): void => {
      if (e.key === KEY) setPref(getThemePref())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = (next: ThemePref): void => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Not persisted, but still applied to this window.
    }
    setPref(next)
    applyTheme(next)
  }
  return [pref, update]
}
