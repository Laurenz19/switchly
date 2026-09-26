import type { ReactNode } from 'react'
import type { Account } from './types'

export const ACCOUNT_COLORS = ['#6d5ae6', '#e0564a', '#1f9d74', '#d98a1c', '#2f7fd8', '#c2489b', '#5f6b7a']

// "Laurenzio-BourdatFinance" → "LB", "Client A" → "CA", "perso" → "PE".
export function initials(label: string): string {
  const words = label.trim().split(/[\s._-]+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

export function Avatar({ account, size = 32 }: { account: Pick<Account, 'label' | 'color'>; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ background: account.color, width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(account.label)}
    </span>
  )
}

export function Notice({ kind, children }: { kind: 'error' | 'warn' | 'ok' | 'info'; children: ReactNode }) {
  return <div className={`notice notice-${kind}`}>{children}</div>
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <h3>{title}</h3>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}
