import { DEFAULT_DEVICE_SHADOW_COLOR, DEFAULT_INK_COLOR } from '@/lib/content-defaults'
import { POPULAR_FONTS } from '@/lib/fonts'
import type { DeviceFrameLayer, DeviceModel, TextLayer } from '@/types'

/**
 * Layer builders shared by the hand-written catalogue (`index.ts`) and the
 * generated one (`catalog.ts`). Extracted rather than duplicated: both need
 * the same defaults (shadow, font, etc.) that a real "add layer" gesture
 * would set.
 */

export function textLayer(
  id: string,
  name: string,
  content: string,
  geometry: Pick<TextLayer, 'x' | 'y' | 'width' | 'height' | 'zIndex'>,
  style: Partial<
    Pick<
      TextLayer,
      | 'fontSize'
      | 'fontWeight'
      | 'color'
      | 'textAlign'
      | 'lineHeight'
      | 'letterSpacing'
      | 'textTransform'
    >
  > = {},
): TextLayer {
  return {
    id,
    type: 'text',
    name,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    fontFamily: POPULAR_FONTS[0],
    fontSize: 48,
    fontWeight: 700,
    color: DEFAULT_INK_COLOR,
    textAlign: 'center',
    lineHeight: 1.12,
    letterSpacing: -0.5,
    textTransform: 'none',
    content,
    ...geometry,
    ...style,
  }
}

export function deviceLayer(
  id: string,
  name: string,
  geometry: Pick<DeviceFrameLayer, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'>,
  color: DeviceFrameLayer['deviceColor'] = 'white-titanium',
  model: DeviceModel = 'iphone-16-pro-max',
): DeviceFrameLayer {
  return {
    id,
    type: 'device-frame',
    name,
    opacity: 1,
    locked: false,
    visible: true,
    deviceModel: model,
    deviceColor: color,
    orientation: 'portrait',
    shadowEnabled: true,
    shadowBlur: 18,
    shadowColor: DEFAULT_DEVICE_SHADOW_COLOR,
    shadowOffsetX: 0,
    shadowOffsetY: 10,
    ...geometry,
  }
}
