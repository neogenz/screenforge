import type { FabricObject } from 'fabric'
import { describe, expect, it } from 'vitest'
import {
  SCREEN_LABEL_FONT_SIZE,
  SCREEN_LABEL_OFFSET,
  scaleScreenLabels,
  screenLabelGeometry,
} from '@/lib/canvas/canvas-utils'

/* Des objets feints plutôt qu'un vrai `Textbox` : Fabric touche au DOM dès son
   constructeur, et `scaleScreenLabels` ne lit qu'un `data`, une taille et un
   `top`. Même parti que `install-fonts.test.ts`. */
function fakeObject(rendererType: string, fontSize = 12, top = -26) {
  const props: Record<string, number> = { fontSize, top }
  return {
    data: { rendererType },
    get top() {
      return props.top
    },
    get fontSize() {
      return props.fontSize
    },
    get: (key: string) => props[key],
    set: (values: Record<string, number>) => Object.assign(props, values),
    setCoords: () => undefined,
  }
}

function labelledScene() {
  const label = fakeObject('label')
  const layer = fakeObject('text', 40, 120)
  const objects = [label, layer] as unknown as FabricObject[]
  return { canvas: { getObjects: () => objects }, label, layer }
}

describe('étiquette de planche', () => {
  /* Le nom de la planche désigne la planche, il n'en fait pas partie : il doit
     mesurer la même chose à l'écran quel que soit le facteur. */
  it.each([0.25, 0.65, 1, 2, 4])('rend 12 px écran à un zoom de %s', (zoom) => {
    const { canvas, label } = labelledScene()

    scaleScreenLabels(canvas, zoom)

    expect(label.fontSize * zoom).toBeCloseTo(SCREEN_LABEL_FONT_SIZE, 10)
    expect(label.top * zoom).toBeCloseTo(-SCREEN_LABEL_OFFSET, 10)
  })

  it('ne touche à rien d’autre que les étiquettes', () => {
    const { canvas, layer } = labelledScene()

    scaleScreenLabels(canvas, 0.65)

    expect(layer.fontSize).toBe(40)
    expect(layer.top).toBe(120)
  })

  /* L'appelant redessine seulement si quelque chose a bougé : un panoramique
     tire autant de rendus qu'un zoom, et rien n'y change de taille. */
  it('signale qu’il n’a rien changé quand le zoom est déjà appliqué', () => {
    const { canvas } = labelledScene()

    expect(scaleScreenLabels(canvas, 0.65)).toBe(true)
    expect(scaleScreenLabels(canvas, 0.65)).toBe(false)
  })

  it('retombe sur le zoom neutre pour un facteur nul', () => {
    expect(screenLabelGeometry(0)).toEqual({
      fontSize: SCREEN_LABEL_FONT_SIZE,
      top: -SCREEN_LABEL_OFFSET,
    })
  })
})
