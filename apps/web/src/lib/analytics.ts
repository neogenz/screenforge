import type {
  CaptureLogOptions,
  CaptureResult,
  LogSeverityLevel,
  PostHog,
  Properties,
} from 'posthog-js'

const STORAGE_KEY = 'screenforge-privacy-v1'
const VERSION = 1
const SERVICE = 'screenforge-web'
const environment = import.meta.env.PROD ? 'production' : 'development'
const appVersion = import.meta.env.VITE_APP_VERSION?.trim() || 'dev'
const gitSha = import.meta.env.VITE_GIT_SHA?.trim() || 'local'

export interface PrivacyChoice {
  version: typeof VERSION
  analytics: boolean
  diagnostic: boolean
}

export const EMPTY_PRIVACY_CHOICE: PrivacyChoice = {
  version: VERSION,
  analytics: false,
  diagnostic: false,
}

type NoProperties = Record<string, never>
type Issue = 'cloud' | 'cloud-partial' | 'export' | 'react-render'
type Provider = 'github' | 'google' | 'polar' | 'resend' | 'unknown'

interface AnalyticsEvents {
  screenforge_editor_opened: NoProperties
  screenforge_landing_cta_clicked: { provider: 'editor' | 'cloud' }
  screenforge_login_succeeded: { provider: Provider }
  screenforge_checkout_started: { provider: 'polar' }
  screenforge_export_succeeded: {
    duration_ms: number
    dimension: string
    screen_count: number
  }
  screenforge_export_failed: {
    duration_ms: number
    dimension: string
    screen_count: number
    issue: 'export'
  }
  screenforge_sync_succeeded: { duration_ms: number }
  screenforge_sync_failed: { duration_ms: number; issue: 'cloud' | 'cloud-partial' }
}

interface DiagnosticLogs {
  export_failed: { issue: 'export' }
  react_render_failed: { issue: 'react-render' }
  sync_failed: { issue: 'cloud' | 'cloud-partial' }
}

const productEvents = new Set<keyof AnalyticsEvents>([
  'screenforge_editor_opened',
  'screenforge_landing_cta_clicked',
  'screenforge_login_succeeded',
  'screenforge_checkout_started',
  'screenforge_export_succeeded',
  'screenforge_export_failed',
  'screenforge_sync_succeeded',
  'screenforge_sync_failed',
])
const productProperties = new Set([
  'environment',
  'version',
  'release',
  'duration_ms',
  'dimension',
  'screen_count',
  'issue',
  'provider',
])
const systemProperties = new Set([
  'token',
  'distinct_id',
  '$device_id',
  '$session_id',
  '$window_id',
  '$lib',
  '$lib_version',
  '$current_url',
  '$pathname',
  '$host',
  '$process_person_profile',
  '$geoip_disable',
  '$is_identified',
])
const logBodies = new Set<keyof DiagnosticLogs>([
  'export_failed',
  'react_render_failed',
  'sync_failed',
])

const projectKey = import.meta.env.VITE_POSTHOG_KEY?.trim()
const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim()

export const analyticsConfigured = Boolean(projectKey && apiHost)

let activeChoice = EMPTY_PRIVACY_CHOICE
let sdk: PostHog | null = null
let pending = Promise.resolve()
let desiredUser: { id: string; email: string | null } | null = null
let identifiedUser: { id: string; email: string | null } | null = null
let editorOpened = false

function isPrivacyChoice(value: unknown): value is PrivacyChoice {
  if (!value || typeof value !== 'object') return false
  const choice = value as Partial<PrivacyChoice>
  return (
    choice.version === VERSION &&
    typeof choice.analytics === 'boolean' &&
    typeof choice.diagnostic === 'boolean'
  )
}

function hasPurpose(choice: PrivacyChoice) {
  return choice.analytics || choice.diagnostic
}

function isProductionHost() {
  if (typeof location === 'undefined') return false
  return location.hostname === 'screenforge.app' || location.hostname === 'www.screenforge.app'
}

function safeUrl(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    const url = new URL(value, typeof location === 'undefined' ? undefined : location.origin)
    return `${url.origin}${url.pathname}`
  } catch {
    return '[redacted]'
  }
}

function safeStack(value: string): string {
  return value
    .split('\n')
    .map((line, index) => {
      if (index === 0) return 'ScreenForgeError: [redacted]'
      return line.replace(/https?:\/\/[^\s)]+/g, (url) => String(safeUrl(url)))
    })
    .join('\n')
}

function redactPrivate(value: unknown, key = ''): unknown {
  if (typeof value === 'string') {
    if (/stack/i.test(key)) return safeStack(value)
    if (/url/i.test(key)) return safeUrl(value)
    if (/message|value|description|error/i.test(key)) return '[redacted]'
    if (/^https?:\/\//.test(value)) return safeUrl(value)
    return value
  }
  if (Array.isArray(value)) return value.map((item) => redactPrivate(item, key))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([childKey, child]) => [childKey, redactPrivate(child, childKey)]),
  )
}

function keepProperties(properties: Properties, allowed: Set<string>): Properties {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) =>
      allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof value)
        ? [[key, key.includes('url') ? safeUrl(value) : value]]
        : [],
    ),
  )
}

export function filterCapturedEvent(result: CaptureResult | null): CaptureResult | null {
  if (!result) return null
  if (productEvents.has(result.event as keyof AnalyticsEvents)) {
    if (!activeChoice.analytics) return null
    return {
      ...result,
      properties: keepProperties(
        result.properties,
        new Set([...systemProperties, ...productProperties]),
      ),
      $set: undefined,
      $set_once: undefined,
    }
  }
  if (result.event === '$web_vitals') {
    return activeChoice.analytics
      ? {
          ...result,
          properties: redactPrivate(result.properties) as Properties,
          $set: undefined,
          $set_once: undefined,
        }
      : null
  }
  if (result.event === '$exception') {
    if (!activeChoice.diagnostic) return null
    const properties = Object.fromEntries(
      Object.entries(result.properties).flatMap(([key, value]) =>
        systemProperties.has(key) || key.startsWith('$exception') || productProperties.has(key)
          ? [[key, redactPrivate(value, key)]]
          : [],
      ),
    )
    return { ...result, properties, $set: undefined, $set_once: undefined }
  }
  if (result.event === '$identify' || result.event === '$set') {
    if (!hasPurpose(activeChoice)) return null
    return {
      ...result,
      properties: keepProperties(result.properties, systemProperties),
      $set: result.$set ? keepProperties(result.$set, new Set(['email'])) : undefined,
      $set_once: undefined,
    }
  }
  return null
}

function filterLog(record: CaptureLogOptions): CaptureLogOptions | null {
  if (!activeChoice.diagnostic || !logBodies.has(record.body as keyof DiagnosticLogs)) return null
  return {
    body: record.body,
    level: record.level,
    attributes: keepProperties(record.attributes ?? {}, new Set(['issue'])),
  }
}

export function readPrivacyChoice(): PrivacyChoice | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    return isPrivacyChoice(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Persister avant d'activer : si le stockage refuse, aucune capture ne démarre. */
export function savePrivacyChoice(choice: PrivacyChoice): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choice))
    return true
  } catch {
    return false
  }
}

async function loadSdk(): Promise<PostHog | null> {
  if (sdk) return sdk
  if (!analyticsConfigured || !projectKey || !apiHost || !hasPurpose(activeChoice)) return null

  const { default: posthog } = await import('posthog-js')
  if (!hasPurpose(activeChoice)) return null

  sdk = posthog.init(projectKey, {
    api_host: apiHost,
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-06-25',
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_performance: { network_timing: false, web_vitals: activeChoice.analytics },
    capture_exceptions: false,
    disable_session_recording: true,
    enable_recording_console_log: false,
    persistence: 'memory',
    person_profiles: 'identified_only',
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    opt_out_useragent_filter: !isProductionHost(),
    disable_capture_url_hashes: true,
    disableDeviceModel: true,
    save_referrer: false,
    save_campaign_params: false,
    ip: false,
    before_send: filterCapturedEvent,
    logs: {
      captureConsoleLogs: false,
      serviceName: SERVICE,
      environment,
      serviceVersion: appVersion,
      beforeSend: filterLog,
    },
    session_recording: {
      sampleRate: 0.2,
      blockSelector: 'canvas, [data-ph-sensitive]',
      maskTextSelector: '*',
      maskAllInputs: true,
      collectFonts: false,
      recordCrossOriginIframes: false,
      recordHeaders: false,
      recordBody: false,
      streamNetworkBody: false,
      captureCanvas: { recordCanvas: false },
    },
  })
  return sdk
}

function resetIdentity(posthog: PostHog) {
  if (!identifiedUser) return
  posthog.reset({ resetDeviceID: true })
  identifiedUser = null
}

function syncIdentity(posthog: PostHog) {
  if (!desiredUser) return resetIdentity(posthog)
  if (identifiedUser?.id !== desiredUser.id) resetIdentity(posthog)
  if (identifiedUser?.id === desiredUser.id && identifiedUser.email === desiredUser.email) return
  posthog.identify(desiredUser.id, desiredUser.email ? { email: desiredUser.email } : {})
  const firstIdentification = !identifiedUser
  identifiedUser = { ...desiredUser }
  if (firstIdentification && activeChoice.analytics) {
    captureAnalytics('screenforge_login_succeeded', { provider: 'unknown' })
  }
}

function stopSdk(posthog: PostHog) {
  posthog.stopSessionRecording()
  posthog.stopExceptionAutocapture()
  posthog.opt_out_capturing()
  posthog.reset({ resetDeviceID: true })
  identifiedUser = null
  posthog.clear_opt_in_out_capturing()
}

async function syncSdk() {
  if (!hasPurpose(activeChoice)) {
    if (sdk) stopSdk(sdk)
    return
  }

  const posthog = await loadSdk()
  if (!posthog) return
  if (!hasPurpose(activeChoice)) {
    stopSdk(posthog)
    return
  }

  posthog.opt_in_capturing({ captureEventName: false })
  posthog.set_config({
    capture_performance: { network_timing: false, web_vitals: activeChoice.analytics },
  })
  if (!isProductionHost()) posthog.setInternalOrTestUser()
  syncIdentity(posthog)
  if (activeChoice.diagnostic) {
    posthog.startExceptionAutocapture({ capture_console_errors: false })
    posthog.startSessionRecording(isProductionHost() ? undefined : { sampling: true })
  } else {
    posthog.stopExceptionAutocapture()
    posthog.stopSessionRecording()
  }
  if (
    activeChoice.analytics &&
    !editorOpened &&
    typeof location !== 'undefined' &&
    location.pathname === '/'
  ) {
    editorOpened = true
    captureAnalytics('screenforge_editor_opened', {})
  }
}

export function captureAnalytics<Name extends keyof AnalyticsEvents>(
  name: Name,
  properties: AnalyticsEvents[Name],
): void {
  if (!activeChoice.analytics) return
  const send = () => {
    if (!sdk || !activeChoice.analytics) return
    sdk.capture(name, {
      ...properties,
      environment,
      version: appVersion,
      release: `${appVersion}+${gitSha.slice(0, 12)}`,
    })
  }
  if (sdk) send()
  else void pending.then(send)
}

export function captureDiagnosticLog<Name extends keyof DiagnosticLogs>(
  name: Name,
  attributes: DiagnosticLogs[Name],
  level: LogSeverityLevel = 'error',
): void {
  if (!sdk || !activeChoice.diagnostic) return
  sdk.captureLog({ body: name, level, attributes })
}

export function captureDiagnosticException(error: unknown, issue: Issue): void {
  if (!sdk || !activeChoice.diagnostic) return
  const safe = new Error(issue)
  safe.name = 'ScreenForgeError'
  if (error instanceof Error && error.stack) safe.stack = safeStack(error.stack)
  sdk.captureException(safe, { issue, environment, version: appVersion })
}

/** Garde l'identité Convex même si la session précède le chargement du SDK. */
export function setAnalyticsUser(user: { id: string; email: string | null } | null): void {
  desiredUser = user ? { ...user } : null
  if (!sdk || !hasPurpose(activeChoice)) return
  syncIdentity(sdk)
}

/** Sérialisé pour qu'un retrait immédiat gagne toujours sur un chargement en cours. */
export function applyPrivacyChoice(choice: PrivacyChoice): Promise<void> {
  activeChoice = choice
  pending = pending.then(syncSdk, syncSdk)
  return pending
}
