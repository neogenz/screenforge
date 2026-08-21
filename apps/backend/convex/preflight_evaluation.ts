import { configuredOrigins } from './origins.ts'

/** Cible évaluée sans lire directement l'environnement du processus. */
export type PreflightTarget = 'preproduction' | 'production'

export type PreflightConfiguration = Readonly<Record<string, string | undefined>>

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

function parseOrigin(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return value === url.origin ? url : null
  } catch {
    return null
  }
}

function emailDomain(value: string | undefined): string | null {
  const match = value?.trim().match(/(?:<)?[^<>\s@]+@([^<>\s]+)>?$/)
  return match?.[1]?.toLowerCase() ?? null
}

/**
 * Vérifie uniquement la présence et les combinaisons dangereuses.
 *
 * Les diagnostics sont des noms de règles, jamais les valeurs. Le même code est
 * exécuté localement sur la configuration production avant le push Convex, puis
 * exposé comme requête interne pour la vérification post-déploiement.
 */
export function evaluatePreflight(target: PreflightTarget, configuration: PreflightConfiguration) {
  const missing = REQUIRED_VARIABLES.filter((name) => !configuration[name]?.trim())
  const inconsistent: string[] = []

  const siteValue = configuration.SITE_URL?.trim()
  const site = parseOrigin(siteValue)
  const cors = configuredOrigins(configuration.CORS_ALLOWED_ORIGINS)
  const checkout = (() => {
    try {
      return configuration.CHECKOUT_SUCCESS_URL
        ? new URL(configuration.CHECKOUT_SUCCESS_URL.trim())
        : null
    } catch {
      return null
    }
  })()

  if (configuration.AUTH_TEST_PASSWORD?.trim()) {
    inconsistent.push(
      target === 'production'
        ? 'AUTH_TEST_PASSWORD_FORBIDDEN_IN_PRODUCTION'
        : 'AUTH_TEST_PASSWORD_REQUIRES_LOOPBACK_SITE_URL',
    )
    if (target === 'preproduction' && isLoopbackOrigin(siteValue)) inconsistent.pop()
  }

  const polarServer = configuration.POLAR_SERVER?.trim() || 'sandbox'
  if (target === 'preproduction' && polarServer === 'production') {
    inconsistent.push('PREPRODUCTION_REQUIRES_POLAR_SANDBOX')
  }
  if (target === 'production' && polarServer !== 'production') {
    inconsistent.push('PRODUCTION_REQUIRES_POLAR_PRODUCTION')
  }

  if (configuration.VERCEL_PREVIEW_HOST_SUFFIX?.trim()) {
    inconsistent.push('VERCEL_PREVIEW_HOST_SUFFIX_FORBIDDEN')
  }

  if (target === 'preproduction') {
    if (!site || site.protocol !== 'https:') {
      inconsistent.push('PREPRODUCTION_REQUIRES_HTTPS_SITE_ORIGIN')
    }
    if (
      !site ||
      !cors?.has(site.origin) ||
      [...(cors ?? [])].some((origin) => new URL(origin).protocol !== 'https:')
    ) {
      inconsistent.push('PREPRODUCTION_REQUIRES_EXACT_HTTPS_CORS')
    }
  }

  if (target === 'production') {
    if (!site || site.protocol !== 'https:')
      inconsistent.push('PRODUCTION_REQUIRES_HTTPS_SITE_ORIGIN')
    if (site?.hostname.endsWith('.vercel.app')) inconsistent.push('PRODUCTION_FORBIDS_PREVIEW_SITE')
    if (!site || !checkout || checkout.origin !== site.origin) {
      inconsistent.push('CHECKOUT_SUCCESS_URL_REQUIRES_SITE_ORIGIN')
    }
    if (!site || cors?.size !== 1 || !cors.has(site.origin)) {
      inconsistent.push('PRODUCTION_REQUIRES_EXACT_SITE_CORS')
    }
    if (emailDomain(configuration.AUTH_EMAIL_FROM) === 'resend.dev') {
      inconsistent.push('PRODUCTION_FORBIDS_RESEND_TEST_DOMAIN')
    }
  }

  return { ready: missing.length === 0 && inconsistent.length === 0, missing, inconsistent }
}
