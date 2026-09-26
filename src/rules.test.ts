import { describe, expect, it } from 'vitest'
import { matchRule, normalizeFolder, validateRules } from './rules'
import type { Account } from './types'

const account = (id: string): Account => ({
  id,
  label: id,
  name: id,
  email: `${id}@example.com`,
  host: 'github',
  username: id,
  sshKeyPath: null,
  signCommits: false,
  color: '#000'
})

describe('normalizeFolder', () => {
  it('uses forward slashes and a trailing slash', () => {
    expect(normalizeFolder('C:\\Dev\\Client A')).toBe('C:/Dev/Client A/')
    expect(normalizeFolder('C:/Dev/')).toBe('C:/Dev/')
    expect(normalizeFolder('C:\\\\Dev\\\\x')).toBe('C:/Dev/x/')
  })
})

describe('matchRule', () => {
  const rules = [
    { folder: 'C:/Dev/', accountId: 'work' },
    { folder: 'C:/Dev/Perso/', accountId: 'perso' }
  ]

  it('picks the most specific folder', () => {
    expect(matchRule(rules, 'C:\\Dev\\Perso\\blog')?.accountId).toBe('perso')
    expect(matchRule(rules, 'C:/Dev/downly')?.accountId).toBe('work')
  })

  it('ignores case, like gitdir/i', () => {
    expect(matchRule(rules, 'c:/dev/PERSO/blog')?.accountId).toBe('perso')
  })

  it('does not match a folder that only shares a prefix', () => {
    expect(matchRule(rules, 'C:/Devices/x')).toBeNull()
    expect(matchRule([{ folder: 'C:/Dev/Perso', accountId: 'p' }], 'C:/Dev/Personal/x')).toBeNull()
  })

  it('matches the rule folder itself', () => {
    expect(matchRule(rules, 'C:/Dev/Perso')?.accountId).toBe('perso')
  })
})

describe('validateRules', () => {
  it('flags duplicate folders and deleted accounts', () => {
    const errors = validateRules(
      [
        { folder: 'C:\\Dev', accountId: 'a' },
        { folder: 'c:/dev/', accountId: 'a' },
        { folder: 'D:/x', accountId: 'gone' }
      ],
      [account('a')]
    )
    expect(errors).toHaveLength(2)
  })
})
