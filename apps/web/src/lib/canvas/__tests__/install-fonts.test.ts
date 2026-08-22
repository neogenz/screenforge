import { afterEach, describe, expect, it, vi } from 'vitest'
import { Canvas, Textbox } from 'fabric'
import type { Project, Screen } from '@/types'
import type { RenderedObject } from '@/lib/canvas/canvas-utils'

/**
 * Ce que la scène doit à une police qui arrive.
 *
 * Le défaut d'origine tenait dans un compte : une requête part par couple
 * famille+graisse, un seul calque avait donc un rappel, et une seule boîte sur
 * six planches était réenroulée. La propriété se vérifie en comptant les boîtes
 * touchées — pas de police réelle, pas de navigateur, pas de mesure.
 *
 * La chaîne est parcourue en entier, de `loadGoogleFont` à la scène : c'est le
 * découplage lui-même qui est vérifié, pas seulement chacune de ses deux moitiés.
 */

const FAMILY = 'Scene Sans'

/** Un `Textbox` sans DOM : `instanceof` tient, rien n'est jamais mesuré. */
function stubTextbox(options: { family?: string; declaredWidth?: number } = {}) {
  const box = Object.create(Textbox.prototype) as Textbox & RenderedObject
  box.fontFamily = options.family ?? FAMILY
  box.initDimensions = vi.fn()
  box.setCoords = vi.fn()
  Object.assign(box, { _set: vi.fn() })
  if (options.declaredWidth !== undefined) box.data = { declaredWidth: options.declaredWidth }
  return box
}

function fakeCanvas(objects: RenderedObject[]) {
  return {
    getObjects: () => objects,
    requestRenderAll: vi.fn(),
  } as unknown as Canvas & { requestRenderAll: ReturnType<typeof vi.fn> }
}

/** Le DOM minimal que `loadGoogleFont` touche, repris de `fonts.test.ts`. */
function stubFontFaces() {
  const link = { sheet: {}, remove: vi.fn() } as unknown as HTMLLinkElement
  vi.stubGlobal('CSS', { escape: (value: string) => value })
  vi.stubGlobal('document', {
    querySelector: () => link,
    fonts: { load: async () => [{} as FontFace], ready: Promise.resolve() },
  } as unknown as Document)
}

const project = {
  target: 'app-store-iphone',
  screens: [{ id: 'screen-1' } as Screen],
} as Project

async function installed(objects: RenderedObject[]) {
  stubFontFaces()
  const { installFonts } = await import('@/lib/canvas/install-fonts')
  const { loadGoogleFont } = await import('@/lib/fonts')
  const canvas = fakeCanvas(objects)
  const generateThumbnails = vi.fn()
  const controller = installFonts({
    currentCanvas: () => canvas,
    getProject: () => project,
    generateThumbnails,
  })
  return { canvas, controller, generateThumbnails, loadGoogleFont }
}

afterEach(() => {
  vi.resetModules()
  vi.unstubAllGlobals()
})

describe('installFonts', () => {
  it('réenroule toutes les boîtes, pas la seule qui a demandé la police', async () => {
    const boxes = [stubTextbox(), stubTextbox(), stubTextbox()]
    const shape = { setCoords: vi.fn() } as unknown as RenderedObject
    const { canvas, generateThumbnails, loadGoogleFont } = await installed([...boxes, shape])

    await loadGoogleFont(FAMILY, ['400'])

    for (const box of boxes) expect(box.initDimensions).toHaveBeenCalledTimes(1)
    expect(shape.setCoords).not.toHaveBeenCalled()
    expect(canvas.requestRenderAll).toHaveBeenCalledTimes(1)
    expect(generateThumbnails).toHaveBeenCalledWith(project.screens, { width: 440, height: 956 })
  })

  it('réenroule aussi les boîtes des autres familles, car le cache est purgé par famille', async () => {
    const carrier = stubTextbox()
    const neighbour = stubTextbox({ family: 'Autre Sans' })
    const { loadGoogleFont } = await installed([carrier, neighbour])

    await loadGoogleFont(FAMILY, ['400'])

    expect(neighbour.initDimensions).toHaveBeenCalledTimes(1)
  })

  it('ignore une famille que personne ne porte sur la scène', async () => {
    // Le sélecteur de polices charge l'aperçu de chaque famille du catalogue :
    // sans cette porte, faire défiler sa liste remesurait toute la scène par
    // ligne survolée.
    const box = stubTextbox()
    const { canvas, generateThumbnails, loadGoogleFont } = await installed([box])

    await loadGoogleFont('Police Jamais Posée', ['400'])

    expect(box.initDimensions).not.toHaveBeenCalled()
    expect(canvas.requestRenderAll).not.toHaveBeenCalled()
    expect(generateThumbnails).not.toHaveBeenCalled()
  })

  it('ne touche plus rien après le démontage du canevas', async () => {
    const box = stubTextbox()
    const { controller, canvas, loadGoogleFont } = await installed([box])

    controller.cleanup()
    await loadGoogleFont(FAMILY, ['400'])

    expect(box.initDimensions).not.toHaveBeenCalled()
    expect(canvas.requestRenderAll).not.toHaveBeenCalled()
  })

  it('rend à la boîte la largeur que le calque déclare', async () => {
    const box = stubTextbox({ declaredWidth: 320 })
    Object.defineProperty(box, 'width', { value: 512, writable: true })
    const { loadGoogleFont } = await installed([box])

    await loadGoogleFont(FAMILY, ['400'])

    expect((box as unknown as { _set: ReturnType<typeof vi.fn> })._set).toHaveBeenCalledWith(
      'width',
      320,
    )
  })
})
