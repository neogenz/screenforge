import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Textbox } from 'fabric'
import {
  fabricObjectToLayerUpdate,
  rewrapTextbox,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'

/**
 * Ce qui remonte du canevas vers le projet, quand Fabric a mesuré large.
 *
 * `Textbox.initDimensions` remonte `width` à la largeur du plus long mot dès
 * qu'un mot dépasse la boîte, et cette largeur-là sort de la police
 * effectivement chargée au moment de la mesure. `object:modified` relit ensuite
 * la géométrie : sans garde, une mesure faite sur la police de secours devenait
 * une donnée du projet, différente d'un navigateur à l'autre et exportée telle
 * quelle. Le gonflement est ici posé à la main — aucune police réelle n'est
 * nécessaire pour prouver ce qui part vers le projet.
 */
function bumpedTextbox(options: {
  declaredWidth: number
  measuredWidth: number
  scaleX?: number
}): Textbox & RenderedObject {
  const box = Object.create(Textbox.prototype) as Textbox & RenderedObject
  box.data = { declaredWidth: options.declaredWidth }
  box.width = options.declaredWidth
  box.height = 120
  box.opacity = 1
  box.setCoords = vi.fn()
  box.set = ((props: Record<string, unknown>) => Object.assign(box, props)) as Textbox['set']
  // Ce que fait Fabric quand un mot ne tient pas dans la boîte.
  box.initDimensions = () => {
    box.width = options.measuredWidth
  }
  box.calcTransformMatrix = () => [options.scaleX ?? 1, 0, 0, 1, 500, 400]
  return box
}

describe('largeur déclarée', () => {
  it('rend à la boîte la largeur du calque après un réenroulement', () => {
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512 })

    rewrapTextbox(box)

    expect(box.width).toBe(320)
  })

  it('n’écrit jamais dans le projet une largeur que Fabric a mesurée', () => {
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512 })

    rewrapTextbox(box)

    expect(fabricObjectToLayerUpdate(box).width).toBe(320)
  })

  it('écrit toujours la largeur d’un vrai redimensionnement', () => {
    // Le contre-test : sans lui, « ne jamais écrire la largeur d'un texte »
    // passerait les deux assertions ci-dessus et casserait la poignée.
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512, scaleX: 1.5 })

    rewrapTextbox(box)

    expect(fabricObjectToLayerUpdate(box).width).toBe(480)
  })

  it('laisse Fabric décider quand le calque ne déclare rien', () => {
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512 })
    box.data = {}

    rewrapTextbox(box)

    expect(box.width).toBe(512)
  })

  /**
   * L'invariant a des dents : un second appelant de `initDimensions` rouvrirait
   * la porte sans qu'aucune assertion de comportement ne bouge, puisqu'il
   * gonflerait la boîte hors de la seule fonction qui sait la dégonfler.
   */
  it('ne laisse qu’un seul appelant à initDimensions dans les sources', () => {
    const root = resolve(import.meta.dirname, '../../..')
    const callers: string[] = []
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== '__tests__') walk(path)
        } else if (/\.tsx?$/.test(entry.name)) {
          if (/\.initDimensions\(/.test(readFileSync(path, 'utf8'))) callers.push(path)
        }
      }
    }
    walk(root)

    expect(callers.map((path) => path.slice(root.length + 1))).toEqual([
      'lib/canvas/canvas-utils.ts',
    ])
  })
})
