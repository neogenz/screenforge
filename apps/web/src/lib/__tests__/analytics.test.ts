import { beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  clear_opt_in_out_capturing: vi.fn(),
  reset: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
  startExceptionAutocapture: vi.fn(),
  stopExceptionAutocapture: vi.fn(),
  setInternalOrTestUser: vi.fn(),
  set_config: vi.fn(),
  capture: vi.fn(),
  captureLog: vi.fn(),
  captureException: vi.fn(),
  identify: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: sdk }))

const entries = new Map<string, string>()

async function analytics() {
  return import('@/lib/analytics')
}

beforeEach(() => {
  entries.clear()
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_screenforge_test')
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.i.posthog.com')
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => void entries.set(key, value),
  })
  sdk.init.mockReturnValue(sdk)
})

describe('frontière de consentement PostHog', () => {
  it('ne charge pas le SDK avant une finalité active', async () => {
    const { applyPrivacyChoice, EMPTY_PRIVACY_CHOICE } = await analytics()
    await applyPrivacyChoice(EMPTY_PRIVACY_CHOICE)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('démarre uniquement le diagnostic avec le contenu privé masqué', async () => {
    const { applyPrivacyChoice } = await analytics()
    await applyPrivacyChoice({ version: 1, analytics: false, diagnostic: true })

    expect(sdk.init).toHaveBeenCalledWith(
      'phc_screenforge_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        enable_recording_console_log: false,
        session_recording: expect.objectContaining({
          maskAllInputs: true,
          maskTextSelector: '*',
          recordBody: false,
          captureCanvas: { recordCanvas: false },
        }),
      }),
    )
    expect(sdk.startExceptionAutocapture).toHaveBeenCalledWith({
      capture_console_errors: false,
    })
    expect(sdk.startSessionRecording).toHaveBeenCalledWith({ sampling: true })
    expect(sdk.set_config).toHaveBeenCalledWith({
      capture_performance: { network_timing: false, web_vitals: false },
    })
  })

  it('retire la capture et renouvelle les identifiants locaux', async () => {
    const { applyPrivacyChoice, EMPTY_PRIVACY_CHOICE } = await analytics()
    await applyPrivacyChoice({ version: 1, analytics: true, diagnostic: false })
    await applyPrivacyChoice(EMPTY_PRIVACY_CHOICE)

    expect(sdk.stopSessionRecording).toHaveBeenCalled()
    expect(sdk.stopExceptionAutocapture).toHaveBeenCalled()
    expect(sdk.reset).toHaveBeenCalledWith({ resetDeviceID: true })
    expect(sdk.opt_out_capturing).toHaveBeenCalled()
    expect(sdk.clear_opt_in_out_capturing).toHaveBeenCalled()
  })

  it('garde la capture inactive si le choix ne peut pas être stocké', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Storage disabled', 'SecurityError')
      },
    })
    const { savePrivacyChoice } = await analytics()
    expect(savePrivacyChoice({ version: 1, analytics: true, diagnostic: true })).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
  })

  it('identifie par ID Convex, garde seulement l’email comme propriété et reset entre comptes', async () => {
    const { applyPrivacyChoice, setAnalyticsUser } = await analytics()
    await applyPrivacyChoice({ version: 1, analytics: true, diagnostic: false })

    setAnalyticsUser({ id: 'convex-user-1', email: 'one@example.test' })
    expect(sdk.identify).toHaveBeenLastCalledWith('convex-user-1', {
      email: 'one@example.test',
    })

    setAnalyticsUser({ id: 'convex-user-2', email: 'two@example.test' })
    expect(sdk.reset).toHaveBeenCalledWith({ resetDeviceID: true })
    expect(sdk.identify).toHaveBeenLastCalledWith('convex-user-2', {
      email: 'two@example.test',
    })
  })

  it('retire URL privée, email événement et contenu d’erreur avant ingestion', async () => {
    const { applyPrivacyChoice, filterCapturedEvent } = await analytics()
    await applyPrivacyChoice({ version: 1, analytics: true, diagnostic: true })

    const product = filterCapturedEvent({
      uuid: 'event-1',
      event: 'screenforge_export_failed',
      properties: {
        token: 'public-project-token',
        distinct_id: 'convex-user-1',
        $current_url: 'https://screenforge.app/?private=sentinel#fragment',
        issue: 'export',
        email: 'private@example.test',
        project_name: 'PRIVATE_SENTINEL',
      },
      $set_once: { $current_url: 'https://screenforge.app/?private=PRIVATE_SENTINEL' },
    })
    expect(product?.properties).toEqual({
      token: 'public-project-token',
      distinct_id: 'convex-user-1',
      $current_url: 'https://screenforge.app/',
      issue: 'export',
    })
    expect(product?.$set_once).toBeUndefined()

    const exception = filterCapturedEvent({
      uuid: 'event-2',
      event: '$exception',
      properties: {
        token: 'public-project-token',
        $exception_list: [
          {
            message: 'PRIVATE_SENTINEL',
            stacktrace: { frames: [{ filename: 'https://screenforge.app/app.js?private=1' }] },
          },
        ],
        project_name: 'PRIVATE_SENTINEL',
      },
    })
    expect(JSON.stringify(exception)).not.toContain('PRIVATE_SENTINEL')
    expect(JSON.stringify(exception)).not.toContain('?private=1')
  })
})
