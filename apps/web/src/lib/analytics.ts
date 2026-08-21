import type { PostHog } from 'posthog-js'

const STORAGE_KEY = 'screenforge-privacy-v1'
const VERSION = 1

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

const projectKey = import.meta.env.VITE_POSTHOG_KEY?.trim()
const apiHost = import.meta.env.VITE_POSTHOG_HOST?.trim()

export const analyticsConfigured = Boolean(projectKey && apiHost)

let activeChoice = EMPTY_PRIVACY_CHOICE
let sdk: PostHog | null = null
let pending = Promise.resolve()

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
    capture_performance: false,
    capture_exceptions: false,
    disable_session_recording: true,
    enable_recording_console_log: false,
    persistence: 'memory',
    person_profiles: 'identified_only',
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    disable_capture_url_hashes: true,
    disableDeviceModel: true,
    save_referrer: false,
    save_campaign_params: false,
    session_recording: {
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

function stopSdk(posthog: PostHog) {
  posthog.stopSessionRecording()
  posthog.stopExceptionAutocapture()
  posthog.opt_out_capturing()
  posthog.reset({ resetDeviceID: true })
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
  if (!isProductionHost()) posthog.setInternalOrTestUser()
  if (activeChoice.diagnostic) {
    posthog.startExceptionAutocapture({ capture_console_errors: false })
    posthog.startSessionRecording()
  } else {
    posthog.stopExceptionAutocapture()
    posthog.stopSessionRecording()
  }
}

/** Sérialisé pour qu'un retrait immédiat gagne toujours sur un chargement en cours. */
export function applyPrivacyChoice(choice: PrivacyChoice): Promise<void> {
  activeChoice = choice
  pending = pending.then(syncSdk, syncSdk)
  return pending
}
