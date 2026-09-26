import type { Account, Rule } from './types'

// Git's includeIf "gitdir/i:" wants forward slashes and a trailing slash
// (which makes it match everything below the folder).
export function normalizeFolder(path: string): string {
  const slashed = path.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return slashed.endsWith('/') ? slashed : `${slashed}/`
}

function isInside(path: string, folder: string): boolean {
  return normalizeFolder(path).toLowerCase().startsWith(normalizeFolder(folder).toLowerCase())
}

// The rule git will apply for a repo: rules are written shortest folder first,
// and a later include wins, so the most specific (longest) folder wins.
export function matchRule(rules: Rule[], repoPath: string): Rule | null {
  let best: Rule | null = null
  for (const rule of rules) {
    if (isInside(repoPath, rule.folder) && (!best || rule.folder.length > best.folder.length)) best = rule
  }
  return best
}

export function accountFor(accounts: Account[], id: string | null | undefined): Account | null {
  return accounts.find((a) => a.id === id) ?? null
}

// Problems that would make a rule set confusing: the same folder twice, or a
// rule pointing at an account that no longer exists.
export function validateRules(rules: Rule[], accounts: Account[]): string[] {
  const errors: string[] = []
  const seen = new Set<string>()
  for (const rule of rules) {
    const key = normalizeFolder(rule.folder).toLowerCase()
    if (seen.has(key)) errors.push(`${normalizeFolder(rule.folder)} has more than one rule.`)
    seen.add(key)
    if (!accountFor(accounts, rule.accountId)) errors.push(`${normalizeFolder(rule.folder)} points to a deleted account.`)
  }
  return errors
}
