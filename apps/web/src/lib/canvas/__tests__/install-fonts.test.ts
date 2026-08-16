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

/** Un `Textbox` sans DOM : `instanceof` tient, rien n'est jamais mesuré. */
function stubTextbox(declaredWidth?: number): Textbox & RenderedObject {
  const box = Object.create(Textbox.prototype) as Textbox & RenderedObject
  box.initDimensions = vi.fn()
  box.setCoords = vi.fn()
  box.set = vi.fn() as unknown as Textbox['set']
  if (declaredWidth !== undefined) box.data = { declaredWidth }
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

const project = { screens: [{ id: 'screen-1' } as Screen] } as Project

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

    await loadGoogleFont('Scene Sans', ['400'])

    for (const box of boxes) expect(box.initDimensions).toHaveBeenCalledTimes(1)
    expect(shape.setCoords).not.toHaveBeenCalled()
    expect(canvas.requestRenderAll).toHaveBeenCalledTimes(1)
    expect(generateThumbnails).toHaveBeenCalledWith(project.screens)
  })

  it('ne touche plus rien après le démontage du canevas', async () => {
    const box = stubTextbox()
    const { controller, canvas, loadGoogleFont } = await installed([box])

    controller.cleanup()
    await loadGoogleFont('Unmounted Sans', ['400'])

    expect(box.initDimensions).not.toHaveBeenCalled()
    expect(canvas.requestRenderAll).not.toHaveBeenCalled()
  })

  it('rend à la boîte la largeur que le calque déclare', async () => {
    const box = stubTextbox(320)
    Object.defineProperty(box, 'width', { value: 512, writable: true })
    const { loadGoogleFont } = await installed([box])

    await loadGoogleFont('Wide Word Sans', ['400'])

    expect(box.set).toHaveBeenCalledWith({ width: 320 })
  })
})
