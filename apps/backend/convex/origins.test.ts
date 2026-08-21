import { describe, expect, test } from 'vitest'
import { configuredOrigins, isAllowedOrigin } from './origins'

const exact = configuredOrigins(
  'https://screenforge.example,https://screenforge-git-branch-team-123.vercel.app',
)

describe('origines web', () => {
  test('accepte uniquement les origines exactes configurées', () => {
    expect(isAllowedOrigin('https://screenforge.example', exact)).toBe(true)
    expect(isAllowedOrigin('https://screenforge-git-branch-team-123.vercel.app', exact)).toBe(true)
  })

  test.each([
    'http://screenforge-git-branch-team-123.vercel.app',
    'https://other-git-branch-team-123.vercel.app',
    'https://screenforge-team-123.vercel.app',
    'https://screenforge-git-branch-team-123.vercel.app.hostile.example',
    'https://screenforge-git-branch-other-team.vercel.app',
    'https://user@screenforge-git-branch-team-123.vercel.app',
    'https://screenforge-git-branch-team-123.vercel.app:444',
    'https://screenforge-git-branch-team-123.vercel.app/path',
    'https://screenforge-x-evil-team-123.vercel.app',
    'https://screenforge-other-team-123.vercel.app',
  ])('refuse %s', (origin) => expect(isAllowedOrigin(origin, exact)).toBe(false))

  test('ferme toute la liste exacte si une entrée est invalide', () => {
    expect(configuredOrigins('https://screenforge.example/path')).toBeNull()
    expect(configuredOrigins('*.vercel.app')).toBeNull()
  })
})
