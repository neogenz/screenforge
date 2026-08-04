import { FabricObject, version } from 'fabric'

export const SELECTION_INK = '#ffffff'
export const SELECTION_HALO = 'rgba(0,0,0,0.6)'
export const GHOST_INK = 'rgba(255,255,255,0.6)'
export const GHOST_HALO = 'rgba(0,0,0,0.3)'

const HALO_SPREAD = 1
const PATCH_MARK = Symbol.for('screenforge.controls-patch')

export type ControlRenderer = (
  ctx: CanvasRenderingContext2D,
  styleOverride?: Record<string, unknown>,
) => void

export type ControlHost = FabricObject & { _renderControls: ControlRenderer }

type MarkedRenderer = ControlRenderer & Record<symbol, ControlRenderer | undefined>

function originalRenderer(renderer: ControlRenderer | undefined): ControlRenderer | undefined {
  return renderer
    ? (renderer as MarkedRenderer)[PATCH_MARK] ?? renderer
    : undefined
}

const renderControlsPlain = originalRenderer(
  (FabricObject.prototype as unknown as Partial<ControlHost>)._renderControls,
)

function renderWith(
  renderer: ControlRenderer,
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  styleOverride: Record<string, unknown> | undefined,
  ink: string,
  halo: string,
): void {
  const width = object.borderScaleFactor
  object.borderScaleFactor = width + HALO_SPREAD * 2
  try {
    renderer.call(object, ctx, {
      ...styleOverride,
      hasControls: false,
      borderColor: halo,
    })
  } finally {
    object.borderScaleFactor = width
  }
  renderer.call(object, ctx, { ...styleOverride, borderColor: ink })
}

export function renderTwoTone(
  object: FabricObject,
  ctx: CanvasRenderingContext2D,
  styleOverride: Record<string, unknown> | undefined,
  ink: string,
  halo: string,
): void {
  if (renderControlsPlain) renderWith(renderControlsPlain, object, ctx, styleOverride, ink, halo)
}

/**
 * Amélioration visuelle validée avec Fabric 7.2.0. `_renderControls` est privé :
 * son absence doit seulement désactiver le cadre bicolore.
 */
export function installControlsPatch(
  target = FabricObject.prototype as unknown as Partial<ControlHost>,
): boolean {
  const current = target._renderControls
  if (typeof current !== 'function') {
    console.warn(`Fabric ${version}: _renderControls indisponible, cadre bicolore désactivé.`)
    return false
  }
  if ((current as MarkedRenderer)[PATCH_MARK]) return true
  const original = originalRenderer(current)!
  const patched: MarkedRenderer = function renderTwoToneControls(
    this: FabricObject,
    ctx: CanvasRenderingContext2D,
    styleOverride?: Record<string, unknown>,
  ) {
    renderWith(original, this, ctx, styleOverride, SELECTION_INK, SELECTION_HALO)
  } as MarkedRenderer
  patched[PATCH_MARK] = original
  target._renderControls = patched
  return true
}
