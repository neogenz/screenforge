import { v } from 'convex/values'
import { env, internalQuery } from './_generated/server'

export type PreflightTarget = 'preproduction' | 'production'

type Configuration = Readonly<Record<string, string | undefined>>

const REQUIRED_VARIABLES = [
  'ABUSE_KEY_SECRET',
  'AUTH_EMAIL_FROM',
  'AUTH_RESEND_KEY',
  'CHECKOUT_SUCCESS_URL',
  'CORS_ALLOWED_ORIGINS',
  'POLAR_ACCESS_TOKEN',
  'POLAR_CLOUD_PRODUCT_ID',
  'POLAR_WEBHOOK_SECRET',
  'SITE_URL',
] as const

function isLoopbackOrigin(value: string | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      value === url.origin &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

/**
 * Vérifie uniquement la présence et les combinaisons dangereuses.
 *
 * Les diagnostics sont des noms de règles, jamais les valeurs : cette fonction
 * peut donc être appelée sur un déploiement réel sans transformer la sortie du
 * CLI ou ses logs en copie de secrets.
 */
export function evaluatePreflight(target: PreflightTarget, configuration: Configuration) {
  const missing = REQUIRED_VARIABLES.filter((name) => !configuration[name]?.trim())
  const inconsistent: string[] = []

  if (
    configuration.AUTH_TEST_PASSWORD?.trim() &&
    !isLoopbackOrigin(configuration.SITE_URL?.trim())
  ) {
    inconsistent.push('AUTH_TEST_PASSWORD_REQUIRES_LOOPBACK_SITE_URL')
  }

  const polarServer = configuration.POLAR_SERVER?.trim() || 'sandbox'
  if (target === 'preproduction' && polarServer === 'production') {
    inconsistent.push('PREPRODUCTION_REQUIRES_POLAR_SANDBOX')
  }
  if (target === 'production' && polarServer !== 'production') {
    inconsistent.push('PRODUCTION_REQUIRES_POLAR_PRODUCTION')
  }

  return { ready: missing.length === 0 && inconsistent.length === 0, missing, inconsistent }
}

export const check = internalQuery({
  args: { target: v.union(v.literal('preproduction'), v.literal('production')) },
  returns: v.object({
    ready: v.boolean(),
    missing: v.array(v.string()),
    inconsistent: v.array(v.string()),
  }),
  handler: (_ctx, { target }) => evaluatePreflight(target, env),
})
