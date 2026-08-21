import {
  ANDROID_DEVICE_MODEL_IDS,
  IPHONE_DEVICE_MODEL_IDS,
  type DeviceModelId,
} from './catalog-ids.ts'
import type { DeviceColor, DevicePlatform, DisplayClass, StoreTargetId } from './types.ts'

export const MAX_PROJECT_SCREENS = 10

export interface StoreTargetProfile {
  id: StoreTargetId
  label: string
  platform: DevicePlatform
  board: { width: number; height: number }
  output: DisplayClass
  zipFolder: string
  maxScreens: number
  deviceModels: readonly DeviceModelId[]
  defaultDeviceModel: DeviceModelId
  defaultDeviceColor: DeviceColor
}

/**
 * The only production profile ScreenForge exports.
 * App Store Connect derives the smaller iPhone screenshot sizes from this set.
 */
export const APP_STORE_TARGET: DisplayClass = {
  name: 'iPhone 6.9 inch',
  size: '6.9"',
  portrait: { width: 1320, height: 2868 },
  landscape: { width: 2868, height: 1320 },
  devices: ['iPhone 16 Pro Max'],
  isPrimary: true,
  isLegacy: false,
}

export const GOOGLE_PLAY_TARGET: DisplayClass = {
  name: 'Google Play phone',
  size: 'phone',
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  devices: ['Android phone'],
  isPrimary: true,
  isLegacy: false,
}

export const APP_STORE_PROFILE: StoreTargetProfile = {
  id: 'app-store-iphone',
  label: 'App Store · iPhone',
  platform: 'apple',
  board: { width: 440, height: 956 },
  output: APP_STORE_TARGET,
  zipFolder: '6.9',
  maxScreens: 10,
  deviceModels: IPHONE_DEVICE_MODEL_IDS,
  defaultDeviceModel: 'iphone-17-pro-max',
  defaultDeviceColor: 'silver',
}

export const GOOGLE_PLAY_PROFILE: StoreTargetProfile = {
  id: 'google-play-phone',
  label: 'Google Play · téléphone',
  platform: 'android',
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
  'google-play-phone': GOOGLE_PLAY_PROFILE,
}

export const STORE_TARGET_IDS = Object.keys(STORE_TARGET_PROFILES) as StoreTargetId[]

export function getStoreTargetProfile(target: StoreTargetId): StoreTargetProfile
export function getStoreTargetProfile(target: unknown): StoreTargetProfile | undefined
export function getStoreTargetProfile(target: unknown): StoreTargetProfile | undefined {
  return typeof target === 'string' ? STORE_TARGET_PROFILES[target as StoreTargetId] : undefined
}

export function deviceModelSupportsTarget(model: DeviceModelId, target: StoreTargetId): boolean {
  return STORE_TARGET_PROFILES[target].deviceModels.includes(model)
}
