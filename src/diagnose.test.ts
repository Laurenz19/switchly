import { describe, expect, it } from 'vitest'
import { diagnose, remoteKind } from './diagnose'
import type { Account, RepoFacts } from './types'

const work: Account = {
  id: 'work',
  label: 'Work',
  name: 'Me',
  email: 'me@work.com',
  host: 'github',
  username: 'me-work',
  sshKeyPath: 'C:/Users/me/.ssh/id_work',
  signCommits: false,
  color: '#000'
}
const perso: Account = { ...work, id: 'perso', label: 'Perso', email: 'me@gmail.com', username: 'me', sshKeyPath: null }
const accounts = [work, perso]
const rules = [{ folder: 'C:/Dev/Work/', accountId: 'work' }]

const facts = (over: Partial<RepoFacts> = {}): RepoFacts => ({
  isRepo: true,
  topLevel: 'C:/Dev/Work/api',
  name: { value: 'Me', scope: 'global', origin: 'file:C:/Users/me/.switchly/work.gitconfig' },
  email: { value: 'me@work.com', scope: 'global', origin: 'file:C:/Users/me/.switchly/work.gitconfig' },
  sshCommand: null,
  signing: null,
  credentialUser: null,
  remoteUrl: 'https://github.com/acme/api.git',
  remoteHost: 'github',
  recentEmails: [],
  ...over
})

const levels = (d: ReturnType<typeof diagnose>): string[] => d.findings.map((f) => f.level)

describe('remoteKind', () => {
  it('recognises https and both ssh forms', () => {
    expect(remoteKind('https://github.com/a/b.git')).toBe('https')
    expect(remoteKind('git@github.com:a/b.git')).toBe('ssh')
    expect(remoteKind('ssh://git@github.com/a/b.git')).toBe('ssh')
    expect(remoteKind(null)).toBeNull()
  })
})

describe('diagnose', () => {
  it('confirms a repo covered by its rule', () => {
    const d = diagnose(facts({ credentialUser: 'me-work' }), 'C:/Dev/Work/api', accounts, rules)
    expect(d.rule?.accountId).toBe('work')
    expect(d.account?.id).toBe('work')
    expect(levels(d)).toEqual(['ok', 'ok'])
  })

  it('warns when the repo overrides the email locally', () => {
    const d = diagnose(
      facts({ email: { value: 'me@gmail.com', scope: 'local', origin: 'file:.git/config' } }),
      'C:/Dev/Work/api',
      accounts,
      rules
    )
    expect(d.findings[0].level).toBe('warn')
    expect(d.findings[0].title).toContain('overrides')
  })

  it('warns when the rule loses to another config', () => {
    const d = diagnose(
      facts({ email: { value: 'me@gmail.com', scope: 'global', origin: 'file:C:/Users/me/.gitconfig' } }),
      'C:/Dev/Work/api',
      accounts,
      rules
    )
    expect(d.findings[0].level).toBe('warn')
  })

  it('explains the global fallback outside every rule', () => {
    const d = diagnose(
      facts({ topLevel: 'C:/Other/blog', email: { value: 'me@gmail.com', scope: 'global', origin: 'file:x' } }),
      'C:/Other/blog',
      accounts,
      rules
    )
    expect(d.rule).toBeNull()
    expect(d.account?.id).toBe('perso')
    expect(d.findings[0].level).toBe('info')
  })

  it('lists recent commits made with other emails', () => {
    const d = diagnose(
      facts({ recentEmails: [{ email: 'me@work.com', count: 8 }, { email: 'me@gmail.com', count: 2 }] }),
      'C:/Dev/Work/api',
      accounts,
      rules
    )
    const other = d.findings.find((f) => f.title.startsWith('Recent commits'))
    expect(other?.detail).toContain('me@gmail.com (2)')
    expect(other?.detail).not.toContain('me@work.com')
  })

  it('warns when HTTPS logs in as the wrong GitHub user', () => {
    const d = diagnose(facts({ credentialUser: 'me' }), 'C:/Dev/Work/api', accounts, rules)
    expect(d.findings.some((f) => f.level === 'warn' && f.title.includes('me-work'))).toBe(true)
  })

  it("doesn't expect a GitHub login on a GitLab remote", () => {
    const d = diagnose(
      facts({ remoteUrl: 'https://gitlab.com/acme/api.git', remoteHost: 'gitlab', credentialUser: 'someone' }),
      'C:/Dev/Work/api',
      accounts,
      rules
    )
    expect(d.findings.some((f) => f.level === 'warn' && f.title.includes('someone'))).toBe(false)
  })

  it('warns when SSH ignores the account key', () => {
    const d = diagnose(facts({ remoteUrl: 'git@github.com:acme/api.git' }), 'C:/Dev/Work/api', accounts, rules)
    expect(d.findings.some((f) => f.level === 'warn' && f.title.includes('default key'))).toBe(true)
  })

  it('reports signed commits, and a signing account whose repo does not sign', () => {
    const signed = diagnose(facts({ signing: { value: 'true', scope: 'global', origin: 'file:x' } }), 'C:/Dev/Work/api', accounts, rules)
    expect(signed.findings.some((f) => f.level === 'ok' && f.title === 'Commits are signed.')).toBe(true)
    const signer = { ...accounts[0], signCommits: true }
    const unsigned = diagnose(facts({ signing: { value: 'false', scope: 'local', origin: 'file:.git/config' } }), 'C:/Dev/Work/api', [signer, accounts[1]], rules)
    expect(unsigned.findings.some((f) => f.level === 'warn' && f.title.includes("won't be signed"))).toBe(true)
  })

  it('stops at a folder that is not a repo', () => {
    const d = diagnose(facts({ isRepo: false }), 'C:/x', accounts, rules)
    expect(d.findings).toHaveLength(1)
    expect(d.findings[0].level).toBe('warn')
  })
})
