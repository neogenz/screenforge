import { describe, expect, test } from 'vitest'
import { evaluatePreflight } from './preflight'

const complete = {
  ABUSE_KEY_SECRET: 'anti-abuse-test-value',
  AUTH_EMAIL_FROM: 'ScreenForge <onboarding@resend.dev>',
  AUTH_GITHUB_ID: 'github-client-test-value',
  AUTH_GITHUB_SECRET: 'github-secret-test-value',
  AUTH_GOOGLE_ID: 'google-client-test-value',
  AUTH_GOOGLE_SECRET: 'google-secret-test-value',
  AUTH_RESEND_KEY: 'resend-test-value',
  CHECKOUT_SUCCESS_URL: 'https://preprod.screenforge.example/?checkout=success',
  CORS_ALLOWED_ORIGINS: 'https://preprod.screenforge.example',
  POLAR_ACCESS_TOKEN: 'polar-test-value',
  POLAR_CLOUD_PRODUCT_ID: 'cloud-product-test-value',
  POLAR_WEBHOOK_SECRET: 'webhook-test-value',
  POSTHOG_HOST: 'https://eu.posthog.com',
  POSTHOG_PERSON_API_KEY: 'posthog-test-value',
  POSTHOG_PROJECT_ID: '123456',
  SITE_URL: 'https://preprod.screenforge.example',
} as const

const production = {
  ...complete,
  AUTH_EMAIL_FROM: 'ScreenForge <hello@screenforge.example>',
  CHECKOUT_SUCCESS_URL: 'https://screenforge.example/?checkout=success',
  CORS_ALLOWED_ORIGINS: 'https://screenforge.example',
  POLAR_SERVER: 'production',
  SITE_URL: 'https://screenforge.example',
} as const

describe('preflight Cloud expurgé', () => {
  test('accepte une préproduction complète sans retourner ses valeurs', () => {
    const result = evaluatePreflight('preproduction', complete)

    expect(result).toEqual({ ready: true, missing: [], inconsistent: [] })
    expect(JSON.stringify(result)).not.toContain('test-value')
  })

  test('nomme seulement la variable absente', () => {
    const result = evaluatePreflight('preproduction', { ...complete, AUTH_RESEND_KEY: undefined })

    expect(result).toEqual({ ready: false, missing: ['AUTH_RESEND_KEY'], inconsistent: [] })
  })

  test.each([
    'AUTH_GITHUB_ID',
    'AUTH_GITHUB_SECRET',
    'AUTH_GOOGLE_ID',
    'AUTH_GOOGLE_SECRET',
  ] as const)('refuse une porte OAuth incomplète : %s', (name) => {
    const result = evaluatePreflight('preproduction', { ...complete, [name]: undefined })

    expect(result).toEqual({ ready: false, missing: [name], inconsistent: [] })
  })

  test('exige la pseudonymisation anti-abus sans retourner sa valeur', () => {
    const result = evaluatePreflight('preproduction', { ...complete, ABUSE_KEY_SECRET: undefined })

    expect(result).toEqual({ ready: false, missing: ['ABUSE_KEY_SECRET'], inconsistent: [] })
    expect(JSON.stringify(result)).not.toContain(complete.ABUSE_KEY_SECRET)
  })

  test('exige la clé de suppression PostHog sans la retourner', () => {
    const result = evaluatePreflight('preproduction', {
      ...complete,
      POSTHOG_PERSON_API_KEY: undefined,
    })

    expect(result.missing).toEqual(['POSTHOG_PERSON_API_KEY'])
    expect(JSON.stringify(result)).not.toContain(complete.POSTHOG_PERSON_API_KEY)
  })

  test.each([
    ['POSTHOG_REQUIRES_EU_MANAGEMENT_HOST', { POSTHOG_HOST: 'https://us.posthog.com' }],
    ['POSTHOG_PROJECT_ID_INVALID', { POSTHOG_PROJECT_ID: '../other' }],
  ])('refuse la configuration PostHog : %s', (rule, override) => {
    const result = evaluatePreflight('preproduction', { ...complete, ...override })
    expect(result.inconsistent).toContain(rule)
    for (const value of Object.values(override)) expect(JSON.stringify(result)).not.toContain(value)
  })

  test('refuse le mot de passe de test hors loopback', () => {
    const result = evaluatePreflight('preproduction', {
      ...complete,
      AUTH_TEST_PASSWORD: '1',
      SITE_URL: 'https://preview.example',
      CORS_ALLOWED_ORIGINS: 'https://preview.example',
    })

    expect(result.inconsistent).toEqual(['AUTH_TEST_PASSWORD_REQUIRES_LOOPBACK_SITE_URL'])
  })

  test('refuse Polar production en préproduction', () => {
    const result = evaluatePreflight('preproduction', {
      ...complete,
      POLAR_SERVER: 'production',
    })

    expect(result.inconsistent).toEqual(['PREPRODUCTION_REQUIRES_POLAR_SANDBOX'])
  })

  test.each([
    ['PREPRODUCTION_REQUIRES_HTTPS_SITE_ORIGIN', { SITE_URL: 'http://localhost:5173' }],
    ['PREPRODUCTION_REQUIRES_EXACT_HTTPS_CORS', { CORS_ALLOWED_ORIGINS: 'https://other.example' }],
  ])('exige une origine hébergée stable en préproduction : %s', (rule, override) => {
    const result = evaluatePreflight('preproduction', { ...complete, ...override })
    expect(result.ready).toBe(false)
    expect(result.inconsistent).toContain(rule)
  })

  test.each(['preproduction', 'production'] as const)(
    'refuse l’ancienne variable Preview en %s',
    (target) => {
      const result = evaluatePreflight(target, {
        ...(target === 'production' ? production : complete),
        VERCEL_PREVIEW_HOST_SUFFIX: '-team.vercel.app',
      })
      expect(result.ready).toBe(false)
      expect(result.inconsistent).toContain('VERCEL_PREVIEW_HOST_SUFFIX_FORBIDDEN')
    },
  )

  test('accepte une production canonique sans valeur de test', () => {
    expect(evaluatePreflight('production', production)).toEqual({
      ready: true,
      missing: [],
      inconsistent: [],
    })
  })

  test.each([
    ['AUTH_TEST_PASSWORD_FORBIDDEN_IN_PRODUCTION', { AUTH_TEST_PASSWORD: '1' }],
    ['PRODUCTION_REQUIRES_HTTPS_SITE_ORIGIN', { SITE_URL: 'http://screenforge.example' }],
    ['PRODUCTION_FORBIDS_PREVIEW_SITE', { SITE_URL: 'https://branch.vercel.app' }],
    [
      'CHECKOUT_SUCCESS_URL_REQUIRES_SITE_ORIGIN',
      { CHECKOUT_SUCCESS_URL: 'https://other.example/?checkout=success' },
    ],
    [
      'PRODUCTION_REQUIRES_EXACT_SITE_CORS',
      { CORS_ALLOWED_ORIGINS: 'https://screenforge.example,https://preview.example' },
    ],
    [
      'PRODUCTION_FORBIDS_RESEND_TEST_DOMAIN',
      { AUTH_EMAIL_FROM: 'ScreenForge <onboarding@resend.dev>' },
    ],
    ['PRODUCTION_REQUIRES_POLAR_PRODUCTION', { POLAR_SERVER: 'sandbox' }],
  ])('refuse en production la règle %s sans divulguer sa valeur', (rule, override) => {
    const result = evaluatePreflight('production', { ...production, ...override })
    expect(result.ready).toBe(false)
    expect(result.inconsistent).toContain(rule)
    for (const value of Object.values(override)) expect(JSON.stringify(result)).not.toContain(value)
  })
})
