import {
  ANDROID_DEVICE_MODEL_IDS,
  IPAD_DEVICE_MODEL_IDS,
  IPHONE_DEVICE_MODEL_IDS,
  WATCH_DEVICE_MODEL_IDS,
  type DeviceModelId,
} from './catalog-ids.ts'
import type {
  DeviceColor,
  DeviceFamily,
  DevicePlatform,
  DisplayClass,
  StoreTargetId,
} from './types.ts'

export const MAX_PROJECT_SCREENS = 10
export const LOGICAL_CANVAS_WIDTH = 440

interface StoreTargetProfileBase {
  id: StoreTargetId
  label: string
  platform: DevicePlatform
  family: DeviceFamily
  board: { width: number; height: number }
  output: DisplayClass
  zipFolder: string
  maxScreens: number
  deviceModels: readonly DeviceModelId[]
  defaultDeviceModel: DeviceModelId
  defaultDeviceColor: DeviceColor
}

export interface AppStoreTargetProfile extends StoreTargetProfileBase {
  platform: 'apple'
  appStoreConnectType: string
}

export interface GooglePlayTargetProfile extends StoreTargetProfileBase {
  platform: 'android'
}

export type StoreTargetProfile = AppStoreTargetProfile | GooglePlayTargetProfile

function output(
  name: string,
  size: string,
  width: number,
  height: number,
  devices: string[],
): DisplayClass {
  return {
    name,
    size,
    portrait: { width, height },
    landscape: { width: height, height: width },
    devices,
    isPrimary: true,
    isLegacy: false,
  }
}

export const APP_STORE_TARGET = output('iPhone 6.9 inch', '6.9"', 1320, 2868, ['iPhone 16 Pro Max'])
export const IPAD_13_TARGET = output('iPad 13 inch', '13"', 2064, 2752, ['iPad 13 inch'])
export const WATCH_ULTRA_422_TARGET = output('Apple Watch Ultra 422 × 514', '422×514', 422, 514, [
  'Apple Watch Ultra',
])
export const WATCH_ULTRA_410_TARGET = output('Apple Watch Ultra 410 × 502', '410×502', 410, 502, [
  'Apple Watch Ultra',
])
export const WATCH_SERIES_10_TARGET = output('Apple Watch Series 10', '416×496', 416, 496, [
  'Apple Watch Series 10',
])
export const WATCH_SERIES_7_TARGET = output('Apple Watch Series 7', '396×484', 396, 484, [
  'Apple Watch Series 7',
])
export const WATCH_SERIES_4_TARGET = output('Apple Watch Series 4', '368×448', 368, 448, [
  'Apple Watch Series 4',
])
export const WATCH_SERIES_3_TARGET = output('Apple Watch Series 3', '312×390', 312, 390, [
  'Apple Watch Series 3',
])
export const GOOGLE_PLAY_TARGET = output('Google Play phone', 'phone', 1080, 1920, [
  'Android phone',
])

function appleProfile(
  id: Exclude<StoreTargetId, 'google-play-phone'>,
  label: string,
  target: DisplayClass,
  zipFolder: string,
  family: 'iphone' | 'ipad' | 'watch',
  appStoreConnectType: string,
): AppStoreTargetProfile {
  const deviceModels =
    family === 'iphone'
      ? IPHONE_DEVICE_MODEL_IDS
      : family === 'ipad'
        ? IPAD_DEVICE_MODEL_IDS
        : WATCH_DEVICE_MODEL_IDS
  return {
    id,
    label,
    platform: 'apple',
    family,
    board: {
      width: LOGICAL_CANVAS_WIDTH,
      height: (LOGICAL_CANVAS_WIDTH * target.portrait.height) / target.portrait.width,
    },
    output: target,
    zipFolder,
    maxScreens: MAX_PROJECT_SCREENS,
    deviceModels,
    defaultDeviceModel: deviceModels[0],
    defaultDeviceColor: family === 'watch' ? 'black' : 'silver',
    appStoreConnectType,
  }
}

export const APP_STORE_PROFILE = appleProfile(
  'app-store-iphone',
  'App Store · iPhone',
  APP_STORE_TARGET,
  '6.9',
  'iphone',
  'APP_IPHONE_69',
)

export const APP_STORE_PROFILES = [
  APP_STORE_PROFILE,
  appleProfile(
    'app-store-ipad-13',
    'App Store · iPad 13 pouces',
    IPAD_13_TARGET,
    'ipad-13',
    'ipad',
    'APP_IPAD_PRO_3GEN_129',
  ),
  appleProfile(
    'app-store-watch-ultra-422x514',
    'App Store · Watch Ultra 422 × 514',
    WATCH_ULTRA_422_TARGET,
    'watch-ultra-422x514',
    'watch',
    'APP_WATCH_ULTRA',
  ),
  appleProfile(
    'app-store-watch-ultra-410x502',
    'App Store · Watch Ultra 410 × 502',
    WATCH_ULTRA_410_TARGET,
    'watch-ultra-410x502',
    'watch',
    'APP_WATCH_ULTRA',
  ),
  appleProfile(
    'app-store-watch-series-10',
    'App Store · Watch Series 10',
    WATCH_SERIES_10_TARGET,
    'watch-series-10',
    'watch',
    'APP_WATCH_SERIES_10',
  ),
  appleProfile(
    'app-store-watch-series-7',
    'App Store · Watch Series 7',
    WATCH_SERIES_7_TARGET,
    'watch-series-7',
    'watch',
    'APP_WATCH_SERIES_7',
  ),
  appleProfile(
    'app-store-watch-series-4',
    'App Store · Watch Series 4',
    WATCH_SERIES_4_TARGET,
    'watch-series-4',
    'watch',
    'APP_WATCH_SERIES_4',
  ),
  appleProfile(
    'app-store-watch-series-3',
    'App Store · Watch Series 3',
    WATCH_SERIES_3_TARGET,
    'watch-series-3',
    'watch',
    'APP_WATCH_SERIES_3',
  ),
] as const satisfies readonly AppStoreTargetProfile[]

export const GOOGLE_PLAY_PROFILE: GooglePlayTargetProfile = {
  id: 'google-play-phone',
  label: 'Google Play · téléphone',
  platform: 'android',
  family: 'android-phone',
  board: { width: 540, height: 960 },
  output: GOOGLE_PLAY_TARGET,
  zipFolder: 'phone',
  maxScreens: 8,
  deviceModels: ANDROID_DEVICE_MODEL_IDS,
  defaultDeviceModel: 'android-phone',
  defaultDeviceColor: 'black',
}

export const STORE_TARGET_PROFILES: Record<StoreTargetId, StoreTargetProfile> = {
  'app-store-iphone': APP_STORE_PROFILE,
  'app-store-ipad-13': APP_STORE_PROFILES[1],
  'app-store-watch-ultra-422x514': APP_STORE_PROFILES[2],
  'app-store-watch-ultra-410x502': APP_STORE_PROFILES[3],
  'app-store-watch-series-10': APP_STORE_PROFILES[4],
  'app-store-watch-series-7': APP_STORE_PROFILES[5],
  'app-store-watch-series-4': APP_STORE_PROFILES[6],
  'app-store-watch-series-3': APP_STORE_PROFILES[7],
  'google-play-phone': GOOGLE_PLAY_PROFILE,
}

export const STORE_TARGET_IDS = Object.keys(STORE_TARGET_PROFILES) as StoreTargetId[]

const LEGACY_APP_STORE_TARGETS: Readonly<Record<string, StoreTargetId>> = {
  'iphone-6.9': 'app-store-iphone',
  'ipad-13': 'app-store-ipad-13',
  'watch-ultra-422x514': 'app-store-watch-ultra-422x514',
  'watch-ultra-410x502': 'app-store-watch-ultra-410x502',
  'watch-series-10': 'app-store-watch-series-10',
  'watch-series-7': 'app-store-watch-series-7',
  'watch-series-4': 'app-store-watch-series-4',
  'watch-series-3': 'app-store-watch-series-3',
}

export function legacyAppStoreTarget(profileId: unknown): StoreTargetId | undefined {
  return typeof profileId === 'string' ? LEGACY_APP_STORE_TARGETS[profileId] : undefined
}

export function getStoreTargetProfile(target: StoreTargetId): StoreTargetProfile
export function getStoreTargetProfile(target: unknown): StoreTargetProfile | undefined
export function getStoreTargetProfile(target: unknown): StoreTargetProfile | undefined {
  return typeof target === 'string' ? STORE_TARGET_PROFILES[target as StoreTargetId] : undefined
}

export function deviceModelSupportsTarget(model: DeviceModelId, target: StoreTargetId): boolean {
  return STORE_TARGET_PROFILES[target].deviceModels.includes(model)
}
