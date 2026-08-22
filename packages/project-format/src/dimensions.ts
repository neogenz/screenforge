import type { DisplayClass } from './types.ts'
import type { DevicePlatform } from './catalog-ids.ts'

export const MAX_PROJECT_SCREENS = 10
export const LOGICAL_CANVAS_WIDTH = 440

export type AppStorePlatform = DevicePlatform

export interface AppStoreProfile extends DisplayClass {
  id: string
  platform: AppStorePlatform
  folder: string
  appStoreConnectType: string
  logical: { width: number; height: number }
}

function profile<const Id extends string>(
  value: Omit<AppStoreProfile, 'id' | 'landscape' | 'logical' | 'isPrimary' | 'isLegacy'> & {
    id: Id
  },
): AppStoreProfile & { id: Id } {
  return {
    ...value,
    landscape: { width: value.portrait.height, height: value.portrait.width },
    logical: {
      width: LOGICAL_CANVAS_WIDTH,
      height: (LOGICAL_CANVAS_WIDTH * value.portrait.height) / value.portrait.width,
    },
    isPrimary: true,
    isLegacy: false,
  }
}

/** Closed catalogue of portrait screenshot sets accepted by ScreenForge. */
export const APP_STORE_PROFILES = [
  profile({
    id: 'iphone-6.9',
    platform: 'iphone',
    name: 'iPhone 6,9 pouces',
    size: '6.9"',
    portrait: { width: 1320, height: 2868 },
    devices: ['iPhone 16 Pro Max'],
    folder: 'iphone-6.9',
    appStoreConnectType: 'APP_IPHONE_69',
  }),
  profile({
    id: 'ipad-13',
    platform: 'ipad',
    name: 'iPad 13 pouces',
    size: '13"',
    portrait: { width: 2064, height: 2752 },
    devices: ['iPad 13 pouces'],
    folder: 'ipad-13',
    appStoreConnectType: 'APP_IPAD_PRO_3GEN_129',
  }),
  profile({
    id: 'watch-ultra-422x514',
    platform: 'watch',
    name: 'Apple Watch Ultra 422 × 514',
    size: '422×514',
    portrait: { width: 422, height: 514 },
    devices: ['Apple Watch Ultra'],
    folder: 'watch-ultra-422x514',
    appStoreConnectType: 'APP_WATCH_ULTRA',
  }),
  profile({
    id: 'watch-ultra-410x502',
    platform: 'watch',
    name: 'Apple Watch Ultra 410 × 502',
    size: '410×502',
    portrait: { width: 410, height: 502 },
    devices: ['Apple Watch Ultra'],
    folder: 'watch-ultra-410x502',
    appStoreConnectType: 'APP_WATCH_ULTRA',
  }),
  profile({
    id: 'watch-series-10',
    platform: 'watch',
    name: 'Apple Watch Series 10',
    size: '416×496',
    portrait: { width: 416, height: 496 },
    devices: ['Apple Watch Series 10'],
    folder: 'watch-series-10',
    appStoreConnectType: 'APP_WATCH_SERIES_10',
  }),
  profile({
    id: 'watch-series-7',
    platform: 'watch',
    name: 'Apple Watch Series 7',
    size: '396×484',
    portrait: { width: 396, height: 484 },
    devices: ['Apple Watch Series 7'],
    folder: 'watch-series-7',
    appStoreConnectType: 'APP_WATCH_SERIES_7',
  }),
  profile({
    id: 'watch-series-4',
    platform: 'watch',
    name: 'Apple Watch Series 4',
    size: '368×448',
    portrait: { width: 368, height: 448 },
    devices: ['Apple Watch Series 4'],
    folder: 'watch-series-4',
    appStoreConnectType: 'APP_WATCH_SERIES_4',
  }),
  profile({
    id: 'watch-series-3',
    platform: 'watch',
    name: 'Apple Watch Series 3',
    size: '312×390',
    portrait: { width: 312, height: 390 },
    devices: ['Apple Watch Series 3'],
    folder: 'watch-series-3',
    appStoreConnectType: 'APP_WATCH_SERIES_3',
  }),
] as const satisfies readonly AppStoreProfile[]

export type AppStoreProfileId = (typeof APP_STORE_PROFILES)[number]['id']

export const DEFAULT_APP_STORE_PROFILE_ID: AppStoreProfileId = 'iphone-6.9'
export const APP_STORE_TARGET = APP_STORE_PROFILES[0]

const PROFILE_BY_ID: ReadonlyMap<string, (typeof APP_STORE_PROFILES)[number]> = new Map(
  APP_STORE_PROFILES.map((item) => [item.id, item]),
)

export function isAppStoreProfileId(value: unknown): value is AppStoreProfileId {
  return typeof value === 'string' && PROFILE_BY_ID.has(value)
}

export function getAppStoreProfile(id: AppStoreProfileId): (typeof APP_STORE_PROFILES)[number]
export function getAppStoreProfile(id: string): (typeof APP_STORE_PROFILES)[number] | undefined
export function getAppStoreProfile(id: string) {
  return PROFILE_BY_ID.get(id)
}

/** Compatibility aliases retained for existing iPhone-only consumers. */
export const PRIMARY_DIMENSION = APP_STORE_TARGET
export const DISPLAY_CLASSES: Record<string, DisplayClass> = {
  [APP_STORE_TARGET.size]: APP_STORE_TARGET,
}
export const EXPORT_DIMENSIONS = [APP_STORE_TARGET]

export function getDisplayClass(size: string): DisplayClass | undefined {
  return size === APP_STORE_TARGET.size ? APP_STORE_TARGET : undefined
}
