const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function canonicalOrigin(value: string): string | null {
  try {
    const url = new URL(value)
    const loopback = LOOPBACK_HOSTS.has(url.hostname)
    return value === url.origin &&
      (url.protocol === 'https:' || (url.protocol === 'http:' && loopback))
      ? value
      : null
  } catch {
    return null
  }
}

export function configuredOrigins(value: string | undefined): ReadonlySet<string> | null {
  if (value === undefined) {
    return new Set([
      'http://localhost:5173',
      'http://localhost:5198',
      'http://localhost:5199',
      'http://localhost:5200',
      'http://127.0.0.1:5173',
    ])
  }
  if (!value.trim()) return null
  const origins = new Set<string>()
  for (const candidate of value.split(',').map((item) => item.trim())) {
    const origin = canonicalOrigin(candidate)
    if (!origin) return null
    origins.add(origin)
  }
  return origins.size ? origins : null
}

function validPreviewSuffix(value: string | undefined): value is string {
  return Boolean(value && /^-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/.test(value))
}

export function isAllowedOrigin(
  origin: string,
  exactOrigins: ReadonlySet<string> | null,
  previewSuffix?: string,
): boolean {
  if (exactOrigins?.has(origin)) return true
  if (!validPreviewSuffix(previewSuffix)) return false
  try {
    const url = new URL(origin)
    if (
      origin !== url.origin ||
      url.protocol !== 'https:' ||
      url.port ||
      url.username ||
      url.password
    ) {
      return false
    }
    if (!url.hostname.startsWith('screenforge-') || !url.hostname.endsWith(previewSuffix))
      return false
    return url.hostname.slice('screenforge-'.length, -previewSuffix.length).length > 0
  } catch {
    return false
  }
}
