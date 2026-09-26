import { describe, expect, it } from 'vitest'
import { initials } from './components'

describe('initials', () => {
  it('splits on spaces, hyphens, dots and underscores', () => {
    expect(initials('Laurenzio-BourdatFinance')).toBe('LB')
    expect(initials('Client A')).toBe('CA')
    expect(initials('work_acme')).toBe('WA')
  })

  it('uses the first two letters of a single word', () => {
    expect(initials('laurenz19')).toBe('LA')
    expect(initials('')).toBe('?')
  })
})
