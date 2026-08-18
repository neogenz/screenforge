import { describe, expect, test } from 'vitest'
import { configuredOrigins, isAllowedOrigin } from './origins'

const exact = configuredOrigins('https://screenforge.example')
const suffix = '-team-123.vercel.app'

describe('origines web', () => {
  test('accepte les origines exactes et le namespace Preview étroit', () => {
    expect(isAllowedOrigin('https://screenforge.example', exact, suffix)).toBe(true)
    expect(
      isAllowedOrigin('https://screenforge-git-branch-team-123.vercel.app', exact, suffix),
    ).toBe(true)
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
  ])('refuse %s', (origin) => expect(isAllowedOrigin(origin, exact, suffix)).toBe(false))

  test.each([
    '*.vercel.app',
    'team-123.vercel.app',
    '-team-123.vercel.app/path',
    '-TEAM.vercel.app',
  ])('ferme une configuration ambiguë %s', (invalid) =>
    expect(
      isAllowedOrigin('https://screenforge-git-branch-team-123.vercel.app', exact, invalid),
    ).toBe(false),
  )

  test('ferme toute la liste exacte si une entrée est invalide', () => {
    expect(configuredOrigins('https://screenforge.example/path')).toBeNull()
  })
})
