import { FabricText, Rect, StaticCanvas } from 'fabric'
import { encode as encodePng } from 'fast-png'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  backgroundToFabricFill,
  disposeFabricObjectResource,
  layerToFabricObject,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import { isFontLoaded, loadGoogleFont } from '@/lib/fonts'
import type { Layer, Screen } from '@/types'

export const INTERNAL_PNG_SIZE_TARGET = 5 * 1024 * 1024

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

export interface PngMetadata {
  width: number
  height: number
  bitDepth: number
  colorType: number
  byteLength: number
}

function encodeOpaquePng(imageData: ImageData): Blob {
  const { width, height, data } = imageData
  const rgb = new Uint8Array(width * height * 3)
  for (let source = 0, destination = 0; source < data.length; source += 4, destination += 3) {
    rgb[destination] = data[source]
    rgb[destination + 1] = data[source + 1]
    rgb[destination + 2] = data[source + 2]
  }
  const png = encodePng({ width, height, data: rgb, depth: 8, channels: 3 }, { zlib: { level: 3 } })
  return new Blob([png.buffer as ArrayBuffer], { type: 'image/png' })
}

async function ensureFonts(layers: Layer[]): Promise<void> {
  const requests = new Map<string, { family: string; weights: Set<string> }>()
  for (const layer of layers) {
    if (layer.type !== 'text') continue
    const request = requests.get(layer.fontFamily) ?? {
      family: layer.fontFamily,
      weights: new Set<string>(),
    }
    request.weights.add(String(layer.fontWeight))
    requests.set(layer.fontFamily, request)
  }

  const results = await Promise.all(
    [...requests.values()].map(({ family, weights }) => {
      const missingWeights = [...weights].filter((weight) => !isFontLoaded(family, [weight]))
      return missingWeights.length === 0
        ? Promise.resolve({ family, status: 'loaded' as const })
        : loadGoogleFont(family, missingWeights)
    }),
  )
  const unavailable = results.filter((result) => result.status === 'fallback')
  if (unavailable.length > 0) {
    throw new Error(
      `Police indisponible : ${unavailable.map((result) => result.family).join(', ')}.`,
    )
  }
  await document.fonts.ready
}

function sortedLayers(screen: Screen, layoutLayers: Layer[], screenIndex: number): Layer[] {
  const panoramaOffset = screenIndex * SCREEN_WIDTH
  return [
    ...screen.layers,
    ...layoutLayers.map((layer) => ({ ...layer, x: layer.x - panoramaOffset })),
  ]
    .filter((layer) => layer.visible)
    .sort((left, right) => left.zIndex - right.zIndex)
}

async function createRenderedObjects(layers: Layer[]): Promise<RenderedObject[]> {
  const results = await Promise.allSettled(layers.map((layer) => layerToFabricObject(layer)))
  const objects = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') {
    objects.forEach(disposeFabricObjectResource)
    throw failure.reason
  }
  return objects
}

async function convertCanvasPngToOpaqueRgb(
  blob: Blob,
  width: number,
  height: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Le navigateur ne peut pas préparer le PNG opaque.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(bitmap, 0, 0, width, height)
    return encodeOpaquePng(context.getImageData(0, 0, width, height))
  } finally {
    bitmap.close()
  }
}

/**
 * Le filigrane du palier gratuit.
 *
 * Peint dans la scène, à ses coordonnées à elle : c'est le `multiplier` qui
 * l'agrandit avec le reste, donc la cible reste au pixel près et
 * `assertAppStorePng` continue de mordre. Un filigrane composé après coup
 * demanderait un second passage sur l'image finale et pourrait, à une erreur
 * d'arrondi près, changer sa taille — soit exactement ce que la validation
 * App Store Connect refuse.
 *
 * Deux objets et pas un : un texte blanc sur un fond noir translucide se lit
 * sur une capture claire comme sur une sombre, ce qu'aucune couleur unique ne
 * fait. Même raison que la pastille des vignettes.
 */
function watermarkObjects(): RenderedObject[] {
  const text = new FabricText('Fait avec ScreenForge', {
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    fill: '#ffffff',
    originX: 'center',
    originY: 'center',
    left: SCREEN_WIDTH / 2,
    top: SCREEN_HEIGHT - 26,
    selectable: false,
    evented: false,
    objectCaching: false,
  })

  const veil = new Rect({
    originX: 'center',
    originY: 'center',
    left: SCREEN_WIDTH / 2,
    top: SCREEN_HEIGHT - 26,
    width: text.width + 20,
    height: 24,
    rx: 12,
    ry: 12,
    fill: 'rgba(0, 0, 0, 0.55)',
    selectable: false,
    evented: false,
    objectCaching: false,
  })

  return [veil, text]
}

/**
 * La scène rendue, avant tout contrat de sortie.
 *
 * Séparée d'`exportScreenToBlob` parce que deux besoins la partagent et qu'un
 * seul porte le contrat App Store : l'export officiel enchaîne dessus la
 * conversion en RGB opaque et `assertAppStorePng`, l'aperçu que le MCP rend à
 * l'agent n'en a que faire — il veut voir la composition, pas la valider chez
 * Apple. Recopier ce montage aurait fait deux moteurs de rendu, et le second
 * aurait fini par ne plus montrer ce que le premier exporte.
 */
export async function renderScreenToBlob(
  screen: Screen,
  layoutLayers: Layer[],
  multiplier: number,
  screenIndex = 0,
  watermark = false,
): Promise<Blob> {
  const layers = sortedLayers(screen, layoutLayers, screenIndex)
  await ensureFonts(layers)

  const exportCanvas = new StaticCanvas(undefined, {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#ffffff',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  let objects: RenderedObject[] = []

  try {
    const background = new Rect({
      originX: 'left',
      originY: 'top',
      left: 0,
      top: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      fill: backgroundToFabricFill(screen.background),
      selectable: false,
      evented: false,
    })
    exportCanvas.add(background)

    objects = await createRenderedObjects(layers)
    /* Après les calques, jamais avant : le filigrane est la dernière chose que
       la scène porte, donc rien de ce que l'utilisateur pose ne le couvre. */
    if (watermark) objects = [...objects, ...watermarkObjects()]
    exportCanvas.add(...objects)
    exportCanvas.requestRenderAll()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const browserPng = await exportCanvas.toBlob({
      format: 'png',
      multiplier,
      enableRetinaScaling: false,
    })
    if (!browserPng) throw new Error('Le navigateur a retourné un PNG vide.')
    return browserPng
  } finally {
    objects.forEach(disposeFabricObjectResource)
    await exportCanvas.dispose()
  }
}

export async function exportScreenToBlob(
  screen: Screen,
  layoutLayers: Layer[],
  targetWidth: number,
  targetHeight: number,
  screenIndex = 0,
  watermark = false,
): Promise<Blob> {
  const scaleX = targetWidth / SCREEN_WIDTH
  const scaleY = targetHeight / SCREEN_HEIGHT
  if (Math.abs(scaleX - scaleY) > Number.EPSILON) {
    throw new Error(
      `Le format ${targetWidth}×${targetHeight} ne respecte pas le ratio du document.`,
    )
  }

  const browserPng = await renderScreenToBlob(screen, layoutLayers, scaleX, screenIndex, watermark)
  const blob = await convertCanvasPngToOpaqueRgb(browserPng, targetWidth, targetHeight)
  assertAppStorePng(await inspectPng(blob), targetWidth, targetHeight)
  return blob
}

export async function inspectPng(blob: Blob): Promise<PngMetadata> {
  const header = new Uint8Array(await blob.slice(0, 33).arrayBuffer())
  if (header.byteLength < 33 || !PNG_SIGNATURE.every((byte, index) => header[index] === byte)) {
    throw new Error('Signature PNG invalide.')
  }
  const chunkLength = new DataView(header.buffer, header.byteOffset + 8, 4).getUint32(0)
  const chunkType = new TextDecoder().decode(header.slice(12, 16))
  if (chunkLength !== 13 || chunkType !== 'IHDR') throw new Error('En-tête PNG invalide.')
  const view = new DataView(header.buffer, header.byteOffset + 16, 13)
  return {
    width: view.getUint32(0),
    height: view.getUint32(4),
    bitDepth: view.getUint8(8),
    colorType: view.getUint8(9),
    byteLength: blob.size,
  }
}

export function assertAppStorePng(
  metadata: PngMetadata,
  expectedWidth: number,
  expectedHeight: number,
): void {
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(
      `Dimensions invalides : ${metadata.width}×${metadata.height}, attendu ${expectedWidth}×${expectedHeight}.`,
    )
  }
  if (metadata.bitDepth !== 8) {
    throw new Error(`Profondeur PNG invalide : ${metadata.bitDepth} bits, attendu 8 bits.`)
  }
  if (metadata.colorType !== 2) {
    throw new Error(`Canal alpha détecté : type PNG ${metadata.colorType}, attendu RGB opaque (2).`)
  }
  if (metadata.byteLength > INTERNAL_PNG_SIZE_TARGET) {
    throw new Error(
      `PNG trop lourd pour la cible interne : ${(metadata.byteLength / 1024 / 1024).toFixed(2)} MB, maximum 5 MB.`,
    )
  }
}
