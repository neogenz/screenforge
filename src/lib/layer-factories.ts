import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/components/canvas/canvas-utils'
import { getDefaultDeviceSize, getDeviceFrame } from '@/assets/device-frames'
import { registerAsset } from '@/lib/assets'
import { DEFAULT_INK_COLOR } from '@/lib/content-defaults'
import { decodeImage, isSupportedImageFile, readAsDataUrl } from '@/lib/image'
import { POPULAR_FONTS } from '@/hooks/use-fonts'
import type { DeviceModel, ImageLayer, ShapeLayer, TextLayer } from '@/types'

/**
 * Layer factories — single source for "add layer" defaults, shared by the
 * toolbar tools, the layers panel and the command palette.
 */

export function createTextLayer(zIndex: number): TextLayer {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    name: 'Texte',
    x: (SCREEN_WIDTH - 320) / 2,
    y: 160,
    width: 300,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    content: 'Titre accrocheur',
    fontFamily: POPULAR_FONTS[0],
    fontSize: 48,
    fontWeight: 700,
    color: DEFAULT_INK_COLOR,
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
  }
}

export function createShapeLayer(zIndex: number): ShapeLayer {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    name: 'Rectangle',
    x: (SCREEN_WIDTH - 200) / 2,
    y: (SCREEN_HEIGHT - 200) / 2,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    shapeType: 'rectangle',
    fill: DEFAULT_INK_COLOR,
  }
}

export function createDeviceLayer(model: DeviceModel, zIndex: number) {
  const config = getDeviceFrame(model)
  const { width, height } = getDefaultDeviceSize(model)
  return {
    id: crypto.randomUUID(),
    type: 'device-frame' as const,
    name: 'iPhone',
    x: (SCREEN_WIDTH - width) / 2,
    y: SCREEN_HEIGHT - height - 120,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    deviceModel: model,
    deviceColor: config.colors[0].name,
    orientation: 'portrait' as const,
  }
}

export type ImageImportResult =
  | { ok: true; layer: ImageLayer }
  | { ok: false; error: string }

/** Reads an image file into a centered, scaled-to-fit image layer. */
export async function createImageLayerFromFile(
  file: File,
  zIndex: number,
): Promise<ImageImportResult> {
  if (!isSupportedImageFile(file)) {
    return { ok: false, error: 'Format non pris en charge. Utilisez un PNG, JPEG ou SVG.' }
  }
  try {
    const dataUrl = await readAsDataUrl(file)
    const image = await decodeImage(dataUrl)
    const assetId = registerAsset(dataUrl)
    const scale = Math.min(600 / image.width, 600 / image.height, 1)
    const width = Math.max(1, image.width * scale)
    const height = Math.max(1, image.height * scale)
    return {
      ok: true,
      layer: {
        id: crypto.randomUUID(),
        type: 'image',
        name: file.name.replace(/\.[^.]+$/, '') || 'Image',
        x: Math.max(0, (SCREEN_WIDTH - width) / 2),
        y: Math.max(0, (SCREEN_HEIGHT - height) / 2),
        width,
        height,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex,
        assetId,
        originalWidth: image.width,
        originalHeight: image.height,
      },
    }
  } catch {
    return { ok: false, error: "L'image est illisible ou endommagée." }
  }
}
