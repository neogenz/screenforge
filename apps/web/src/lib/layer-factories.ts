import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { getDefaultDeviceSize, getDeviceFrame } from '@/assets/device-frames'
import { registerAsset } from '@/lib/assets'
import { DEFAULT_DEVICE_SHADOW_COLOR, DEFAULT_INK_COLOR } from '@/lib/content-defaults'
import { imageImportErrorMessage, importImageFile } from '@/lib/image'
import { POPULAR_FONTS } from '@/lib/fonts'
import {
  DEFAULT_ICON_ID,
  ICON_STROKE,
  iconEntry,
  shapeEntry,
  type IconId,
  type ShapeId,
} from '@/lib/vector-catalog'
import { Path } from 'fabric'
import type { DeviceModel, IconLayer, ImageLayer, ShapeLayer, TextLayer } from '@/types'

/**
 * Layer factories — single source for "add layer" defaults, shared by the
 * toolbar tools, the layers panel and the command palette.
 */

/** Nom d'usine d'un calque de texte, avant que l'utilisateur ne le renomme. */
const DEFAULT_TEXT_NAME = 'Texte'

/**
 * Nom affiché d'un calque.
 *
 * Un calque de texte porte son contenu tant que personne ne l'a renommé : une
 * liste de treize lignes « Texte » ne dit rien de la maquette, alors que
 * « Titre accrocheur » se retrouve du premier coup d'œil. C'est le
 * comportement de Figma et de Sketch.
 *
 * L'heuristique du « jamais renommé » est le nom d'usine lui-même : renommer
 * un calque exactement « Texte » le remet donc sous son contenu. Le cas est
 * sans conséquence, et le seul autre moyen serait de stocker un drapeau de
 * renommage dans le fichier de projet.
 */
export function layerDisplayName(layer: { type: string; name: string; content?: string }): string {
  if (layer.type !== 'text' || layer.name !== DEFAULT_TEXT_NAME) return layer.name
  const firstLine = layer.content?.split('\n')[0]?.trim()
  return firstLine || layer.name
}

export function createTextLayer(zIndex: number): TextLayer {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    name: DEFAULT_TEXT_NAME,
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

export function createShapeLayer(zIndex: number, shapeType: ShapeId = 'rectangle'): ShapeLayer {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    name: shapeEntry(shapeType)?.label ?? 'Forme',
    x: (SCREEN_WIDTH - 200) / 2,
    y: (SCREEN_HEIGHT - 200) / 2,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    shapeType,
    fill: DEFAULT_INK_COLOR,
  }
}

const ICON_SIZE = 120

/**
 * La boîte d'une icône suit le rapport de son tracé.
 *
 * Le rapport est mesuré par le moteur qui la rendra, pas recopié dans le
 * catalogue : une coche est deux fois plus large que haute, et l'étirer dans un
 * carré la déforme dès l'insertion. Rien n'est ajouté au canevas — l'objet
 * sert de règle et est jeté.
 */
export function createIconLayer(zIndex: number, iconId: IconId = DEFAULT_ICON_ID): IconLayer {
  const entry = iconEntry(iconId) ?? iconEntry(DEFAULT_ICON_ID)!
  const probe = new Path(entry.path)
  const ratio = probe.width > 0 && probe.height > 0 ? probe.width / probe.height : 1
  const width = ICON_SIZE * Math.min(1, ratio)
  const height = ICON_SIZE * Math.min(1, 1 / ratio)
  return {
    id: crypto.randomUUID(),
    type: 'icon',
    name: entry.label,
    x: (SCREEN_WIDTH - width) / 2,
    y: (SCREEN_HEIGHT - height) / 2,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex,
    iconId: entry.id,
    color: DEFAULT_INK_COLOR,
    strokeWidth: ICON_STROKE,
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
    shadowEnabled: true,
    shadowBlur: 18,
    shadowColor: DEFAULT_DEVICE_SHADOW_COLOR,
    shadowOffsetX: 0,
    shadowOffsetY: 10,
  }
}

export type ImageImportResult = { ok: true; layer: ImageLayer } | { ok: false; error: string }

/** Reads an image file into a centered, scaled-to-fit image layer. */
export async function createImageLayerFromFile(
  file: File,
  zIndex: number,
): Promise<ImageImportResult> {
  try {
    const image = await importImageFile(file)
    const assetId = registerAsset(image.dataUrl)
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
  } catch (error) {
    return { ok: false, error: imageImportErrorMessage(error) }
  }
}
