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

export function diagnose(facts: RepoFacts, repoPath: string, accounts: Account[], rules: Rule[]): Diagnosis {
  const rule = matchRule(rules, facts.topLevel ?? repoPath)
  const ruleAccount = accountFor(accounts, rule?.accountId)
  const email = facts.email?.value ?? null
  const account = accounts.find((a) => sameEmail(a.email, email)) ?? null
  const findings: Finding[] = []

  if (!facts.isRepo) {
    return { account: null, rule, findings: [{ level: 'warn', title: 'This folder is not a git repository.' }] }
  }

  // Which identity commits will use, and why.
  if (!email) {
    findings.push({ level: 'warn', title: 'No commit email is set.', detail: 'Git will refuse to commit until user.email is set.' })
  } else if (facts.email?.scope === 'local') {
    findings.push({
      level: 'warn',
      title: `This repo overrides the email locally (${email}).`,
      detail: ruleAccount
        ? `Its own .git/config wins over the rule for ${ruleAccount.label}. Remove it with: git config --unset user.email`
        : 'Its own .git/config sets user.email, so no rule or global switch applies here.'
    })
  } else if (rule && ruleAccount) {
    if (sameEmail(ruleAccount.email, email)) {
      findings.push({ level: 'ok', title: `Commits use ${ruleAccount.label} (${email}), from the rule for ${rule.folder}.` })
    } else {
      findings.push({
        level: 'warn',
        title: `A rule says ${ruleAccount.label}, but commits would use ${email}.`,
        detail: 'Another config file wins over the rule. Check the origin below.'
      })
    }
  } else {
    findings.push({
      level: 'info',
      title: `No rule covers this repo: commits use the global identity (${account?.label ?? email}).`,
      detail: 'Add a folder rule to pin an account to this repo.'
    })
  }

  // Past commits made with a different email.
  const others = facts.recentEmails.filter((e) => !sameEmail(e.email, email))
  if (email && others.length > 0) {
    const list = others.map((e) => `${e.email} (${e.count})`).join(', ')
    findings.push({
      level: 'info',
      title: 'Recent commits use other emails.',
      detail: `${list}. Normal on a shared repo; on your own repo, these were made with the wrong identity.`
    })
  }

  // How pushes authenticate.
  const kind = remoteKind(facts.remoteUrl)
  if (kind === 'ssh') {
    if (facts.sshCommand) {
      findings.push({ level: 'ok', title: 'Pushes over SSH use a dedicated key.', detail: facts.sshCommand.value })
    } else if (account && account.sshKeyPath) {
      findings.push({ level: 'warn', title: 'Pushes over SSH use your default key, not this account\'s key.' })
    } else {
      findings.push({ level: 'info', title: 'Pushes over SSH use your default key (~/.ssh/id_*).' })
    }
  } else if (kind === 'https') {
    const expected = ruleAccount?.githubUser || account?.githubUser
    if (facts.credentialUser) {
      if (expected && facts.credentialUser.toLowerCase() !== expected.toLowerCase()) {
        findings.push({ level: 'warn', title: `Pushes log in as ${facts.credentialUser}, but the account is ${expected} on GitHub.` })
      } else {
        findings.push({ level: 'ok', title: `Pushes over HTTPS log in as ${facts.credentialUser}.` })
      }
    } else {
      findings.push({
        level: 'info',
        title: 'No GitHub account is pinned for HTTPS pushes.',
        detail: 'Git Credential Manager will use its default account, or ask if it has several.'
      })
    }
  } else if (!facts.remoteUrl) {
    findings.push({ level: 'info', title: 'This repo has no "origin" remote.' })
  }

  return { account, rule, findings }
}
