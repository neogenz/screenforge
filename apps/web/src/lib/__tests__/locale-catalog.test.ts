import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultSourceLanguage,
  LOCALE_CATALOG,
  localeEntry,
  localeName,
} from '@/lib/locale-catalog'
import { APP_STORE_LOCALES } from '@/lib/asc'

afterEach(() => vi.unstubAllGlobals())

describe('catalogue des langues', () => {
  it('est le catalogue App Store Connect, et rien d’autre', () => {
    expect(LOCALE_CATALOG.map((entry) => entry.code)).toEqual(APP_STORE_LOCALES)
    expect(new Set(LOCALE_CATALOG.map((entry) => entry.code)).size).toBe(LOCALE_CATALOG.length)
    expect(localeEntry('FR-fr')?.code).toBe('fr-FR')
    expect(localeEntry('ja')?.script).toBe('japanese')
    expect(localeEntry('xx')).toBeUndefined()
  })

  it('nomme une langue par le projet, puis le catalogue, puis son code', () => {
    expect(localeName('de-DE')).toBe('Allemand')
    expect(localeName('xx')).toBe('xx')
    expect(localeName('de-DE', [{ code: 'de-DE', name: 'Deutsch' }])).toBe('Deutsch')
  })

  it('devine la langue d’origine depuis le navigateur, dans le catalogue seulement', () => {
    vi.stubGlobal('navigator', { language: 'en' })
    expect(defaultSourceLanguage()).toBe('en-US')
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(defaultSourceLanguage()).toBe('fr-FR')
    vi.stubGlobal('navigator', { language: 'pt' })
    expect(defaultSourceLanguage()).toBe('pt-BR')
    vi.stubGlobal('navigator', { language: 'xx-YY' })
    expect(defaultSourceLanguage()).toBe('en-US')
  })
})
