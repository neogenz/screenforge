import { describe, expect, it } from 'vitest'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  clampLayerToBoard,
  escapesScreen,
  getScreenOffset,
  intersectsScreen,
  layerOutOfReach,
} from '@/lib/canvas/canvas-utils'
import type { FabricObject } from 'fabric'

/**
 * Ce que la scène promet à un calque sorti de sa planche.
 *
 * Deux seuils distincts, et c'est tout l'intérêt : **déborder** allume le
 * fantôme, **ne plus mordre** retire la prise. Un calque à cheval sur le bord
 * est donc atténué au-dehors et toujours saisissable — une composition qui
 * déborde volontairement reste modifiable au doigt.
 */

/** Les deux fonctions ne lisent que la boîte : un stub suffit, et évite Fabric. */
function boxed(left: number, top: number, width: number, height: number): FabricObject {
  return { getBoundingRect: () => ({ left, top, width, height }) } as unknown as FabricObject
}

describe('déborder de sa planche', () => {
  it('ne signale rien tant que le calque tient dans la fenêtre', () => {
    expect(escapesScreen(boxed(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT), 0)).toBe(false)
    expect(escapesScreen(boxed(20, 30, 100, 100), 0)).toBe(false)
  })

  it('tolère le demi-pixel du liseré, pas davantage', () => {
    expect(escapesScreen(boxed(-0.5, 0, 100, 100), 0)).toBe(false)
    expect(escapesScreen(boxed(-1, 0, 100, 100), 0)).toBe(true)
  })

  it('lit la fenêtre de la planche visée, pas celle de la première', () => {
    const onSecond = boxed(getScreenOffset(1) + 20, 20, 100, 100)
    expect(escapesScreen(onSecond, 1)).toBe(false)
    expect(escapesScreen(onSecond, 0)).toBe(true)
  })

  it('voit aussi les débordements par le bas et par la droite', () => {
    expect(escapesScreen(boxed(SCREEN_WIDTH - 10, 0, 100, 100), 0)).toBe(true)
    expect(escapesScreen(boxed(0, SCREEN_HEIGHT - 10, 100, 100), 0)).toBe(true)
  })
})

describe('rester saisissable', () => {
  it('garde la prise à un calque qui déborde encore largement dessus', () => {
    const straddling = boxed(-60, 100, 100, 100)
    expect(escapesScreen(straddling, 0)).toBe(true)
    expect(intersectsScreen(straddling, 0)).toBe(true)
  })

  it('la retire dès que le recouvrement se réduit à un ruban', () => {
    expect(intersectsScreen(boxed(-92, 100, 100, 100), 0)).toBe(false)
    expect(intersectsScreen(boxed(-100, 100, 100, 100), 0)).toBe(false)
  })

  it('la retire aussi quand le calque est passé dans la gouttière', () => {
    expect(intersectsScreen(boxed(SCREEN_WIDTH + 10, 100, 100, 100), 0)).toBe(false)
  })
})

describe('l’issue du panneau', () => {
  /* Le panneau lit la boîte déclarée du calque, la planche prise en zéro. Il
     doit s'allumer exactement quand le canevas vient de retirer la prise, sans
     quoi un calque injoignable n'aurait plus rien pour le rappeler. */
  it('s’allume au même seuil que la perte de prise', () => {
    expect(layerOutOfReach({ x: -60, y: 100, width: 100, height: 100 })).toBe(false)
    expect(layerOutOfReach({ x: -92, y: 100, width: 100, height: 100 })).toBe(true)
    expect(layerOutOfReach({ x: 100, y: SCREEN_HEIGHT + 1, width: 100, height: 100 })).toBe(true)
  })

  it('repose le calque entier sur la planche, au plus près d’où il était', () => {
    expect(clampLayerToBoard({ x: -300, y: -80, width: 100, height: 100 })).toEqual({ x: 0, y: 0 })
    expect(clampLayerToBoard({ x: 900, y: 2_000, width: 100, height: 100 })).toEqual({
      x: SCREEN_WIDTH - 100,
      y: SCREEN_HEIGHT - 100,
    })
    // Un seul axe fautif ne déplace pas l'autre.
    expect(clampLayerToBoard({ x: 900, y: 300, width: 100, height: 100 })).toEqual({
      x: SCREEN_WIDTH - 100,
      y: 300,
    })
  })

  it('ne pousse jamais un calque plus grand que la planche hors du coin', () => {
    expect(clampLayerToBoard({ x: -50, y: -50, width: 900, height: 2_000 })).toEqual({ x: 0, y: 0 })
  })
})

describe('planche explicite', () => {
  it('emploie les bornes Android sans constante Apple implicite', () => {
    const android = { width: 540, height: 960 }
    expect(escapesScreen(boxed(0, 0, 540, 960), 0, android)).toBe(false)
    expect(escapesScreen(boxed(530, 0, 20, 20), 0, android)).toBe(true)
    expect(clampLayerToBoard({ x: 600, y: 1_000, width: 100, height: 100 }, android)).toEqual({
      x: 440,
      y: 860,
    })
  })
})
