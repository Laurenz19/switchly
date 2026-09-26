import { en, type Messages } from './locales/en'
import { accountFor, matchRule } from './rules'
import type { Account, RepoFacts, Rule } from './types'

export type FindingLevel = 'ok' | 'info' | 'warn'

export interface Finding {
  level: FindingLevel
  title: string
  detail?: string
}

export interface Diagnosis {
  // The account the repo's effective email belongs to, if any.
  account: Account | null
  // The rule covering the repo, if any.
  rule: Rule | null
  findings: Finding[]
}

export function remoteKind(url: string | null): 'ssh' | 'https' | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return 'https'
  if (/^(ssh:\/\/|[\w.-]+@[\w.-]+:)/i.test(url)) return 'ssh'
  return null
}

function sameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
}

// `m` is the current language's messages; English by default (and in tests).
export function diagnose(
  facts: RepoFacts,
  repoPath: string,
  accounts: Account[],
  rules: Rule[],
  m: Messages['findings'] = en.findings
): Diagnosis {
  const rule = matchRule(rules, facts.topLevel ?? repoPath)
  const ruleAccount = accountFor(accounts, rule?.accountId)
  const email = facts.email?.value ?? null
  const account = accounts.find((a) => sameEmail(a.email, email)) ?? null
  const findings: Finding[] = []

  if (!facts.isRepo) {
    return { account: null, rule, findings: [{ level: 'warn', title: m.notRepo }] }
  }

  // Which identity commits will use, and why.
  if (!email) {
    findings.push({ level: 'warn', title: m.noEmail, detail: m.noEmailDetail })
  } else if (facts.email?.scope === 'local') {
    findings.push({
      level: 'warn',
      title: m.localOverride(email),
      detail: ruleAccount ? m.localOverrideRule(ruleAccount.label) : m.localOverrideNoRule
    })
  } else if (rule && ruleAccount) {
    if (sameEmail(ruleAccount.email, email)) {
      findings.push({ level: 'ok', title: m.ruleOk(ruleAccount.label, email, rule.folder) })
    } else {
      findings.push({ level: 'warn', title: m.ruleLoses(ruleAccount.label, email), detail: m.ruleLosesDetail })
    }
  } else {
    findings.push({ level: 'info', title: m.noRule(account?.label ?? email), detail: m.noRuleDetail })
  }

  // Past commits made with a different email.
  const others = facts.recentEmails.filter((e) => !sameEmail(e.email, email))
  if (email && others.length > 0) {
    const list = others.map((e) => `${e.email} (${e.count})`).join(', ')
    findings.push({ level: 'info', title: m.otherEmails, detail: m.otherEmailsDetail(list) })
  }

  // How pushes authenticate.
  const kind = remoteKind(facts.remoteUrl)
  if (kind === 'ssh') {
    if (facts.sshCommand) {
      findings.push({ level: 'ok', title: m.sshDedicated, detail: facts.sshCommand.value })
    } else if (account && account.sshKeyPath) {
      findings.push({ level: 'warn', title: m.sshDefaultNotAccount })
    } else {
      findings.push({ level: 'info', title: m.sshDefault })
    }
  } else if (kind === 'https') {
    // Only an account on the remote's site says which login to expect.
    const onRemoteHost = (a: Account | null): Account | null =>
      a && (!facts.remoteHost || a.host === facts.remoteHost) ? a : null
    const expected = onRemoteHost(ruleAccount)?.username || onRemoteHost(account)?.username
    if (facts.credentialUser) {
      if (expected && facts.credentialUser.toLowerCase() !== expected.toLowerCase()) {
        findings.push({ level: 'warn', title: m.httpsWrongUser(facts.credentialUser, expected) })
      } else {
        findings.push({ level: 'ok', title: m.httpsOk(facts.credentialUser) })
      }
    } else {
      findings.push({ level: 'info', title: m.httpsNone, detail: m.httpsNoneDetail })
    }
  } else if (!facts.remoteUrl) {
    findings.push({ level: 'info', title: m.noRemote })
  }

  return { account, rule, findings }
}
