import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  commitTheme,
  installUserSettings,
  newerSettings,
  onUserSettingsCommitted,
  readBootTheme,
  readUserSettings,
} from '@/lib/user-settings'

const entries = new Map<string, string>()

beforeEach(() => {
  entries.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  })
})

describe('user settings locales', () => {
  it('garde le thème de boot local sans le donner à un autre compte', () => {
    entries.set('screenforge-theme', 'light')
    expect(readBootTheme()).toBe('light')
    expect(readUserSettings(null).theme).toBe('light')
    expect(readUserSettings('compte-neuf').theme).toBe('dark')
  })

  it('date les changements strictement et notifie seulement les commits locaux', () => {
    const received: number[] = []
    const stop = onUserSettingsCommitted((userId, settings) => {
      if (userId === 'compte-commit') received.push(settings.updatedAt)
    })

    const first = commitTheme('compte-commit', 'light')
    const second = commitTheme('compte-commit', 'dark')
    installUserSettings('compte-commit', { theme: 'light', updatedAt: second.updatedAt + 1 })
    stop()

    expect(second.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(received).toEqual([first.updatedAt, second.updatedAt])
    expect(readUserSettings('compte-commit').theme).toBe('light')
  })

  it('ignore une forme locale inconnue et applique le LWW, égalité au serveur', () => {
    entries.set(
      'screenforge-user-settings:compte-invalide',
      JSON.stringify({ theme: 'light', updatedAt: 10, apiKey: 'secret' }),
    )
    expect(readUserSettings('compte-invalide')).toEqual({ theme: 'dark', updatedAt: 0 })

    const local = { theme: 'light' as const, updatedAt: 10 }
    expect(newerSettings(local, { theme: 'dark', updatedAt: 9 })).toBe(local)
    expect(newerSettings(local, { theme: 'dark', updatedAt: 10 })).toEqual({
      theme: 'dark',
      updatedAt: 10,
    })
  })
})
