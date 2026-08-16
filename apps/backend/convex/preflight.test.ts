import { describe, expect, test } from 'vitest'
import { evaluatePreflight } from './preflight'

const complete = {
  AUTH_EMAIL_FROM: 'ScreenForge <onboarding@resend.dev>',
  AUTH_RESEND_KEY: 'resend-test-value',
  CHECKOUT_SUCCESS_URL: 'http://localhost:5173/?checkout=success',
  CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  POLAR_ACCESS_TOKEN: 'polar-test-value',
  POLAR_CLOUD_PRODUCT_ID: 'cloud-product-test-value',
  POLAR_WEBHOOK_SECRET: 'webhook-test-value',
  SITE_URL: 'http://localhost:5173',
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
})
