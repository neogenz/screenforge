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
    expect(sdk.startSessionRecording).toHaveBeenCalledOnce()
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
})
