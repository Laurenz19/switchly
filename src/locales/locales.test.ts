import { describe, expect, it } from 'vitest'
import { en } from './en'
import { fr } from './fr'

// Every key path, with the type of its value: a string must stay a string
// and a function a function, in every locale.
function shape(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? shape(value, `${prefix}${key}.`) : [`${prefix}${key}:${typeof value}`]
  )
}

describe('locales', () => {
  it('French has exactly the English keys', () => {
    expect(shape(fr).sort()).toEqual(shape(en).sort())
  })

  it('keeps {placeholders} in templates', () => {
    const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort()
    const check = (a: object, b: object): void => {
      for (const [key, value] of Object.entries(a)) {
        const other = (b as Record<string, unknown>)[key]
        if (typeof value === 'string') expect(placeholders(other as string), key).toEqual(placeholders(value))
        else if (typeof value === 'object' && value !== null) check(value, other as object)
      }
    }
    check(en, fr)
  })

  it('pluralizes folder counts', () => {
    expect(en.nav.folderCount(1)).toBe('1 folder')
    expect(en.nav.folderCount(3)).toBe('3 folders')
    expect(fr.nav.folderCount(0)).toBe('0 dossier')
    expect(fr.nav.folderCount(2)).toBe('2 dossiers')
  })
})
