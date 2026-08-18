import { describe, expect, test } from 'vitest'
import { evaluatePreflight } from './preflight'

const complete = {
  ABUSE_KEY_SECRET: 'anti-abuse-test-value',
  AUTH_EMAIL_FROM: 'ScreenForge <onboarding@resend.dev>',
  AUTH_RESEND_KEY: 'resend-test-value',
  CHECKOUT_SUCCESS_URL: 'http://localhost:5173/?checkout=success',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  POLAR_ACCESS_TOKEN: 'polar-test-value',
  POLAR_CLOUD_PRODUCT_ID: 'cloud-product-test-value',
  POLAR_WEBHOOK_SECRET: 'webhook-test-value',
  SITE_URL: 'http://localhost:5173',
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

  test('exige la pseudonymisation anti-abus sans retourner sa valeur', () => {
    const result = evaluatePreflight('preproduction', { ...complete, ABUSE_KEY_SECRET: undefined })

    expect(result).toEqual({ ready: false, missing: ['ABUSE_KEY_SECRET'], inconsistent: [] })
    expect(JSON.stringify(result)).not.toContain(complete.ABUSE_KEY_SECRET)
  })

  test('refuse le mot de passe de test hors loopback', () => {
    const result = evaluatePreflight('preproduction', {
      ...complete,
      AUTH_TEST_PASSWORD: '1',
      SITE_URL: 'https://preview.example',
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
