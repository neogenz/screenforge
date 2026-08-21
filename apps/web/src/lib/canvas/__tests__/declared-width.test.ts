import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Point, Textbox } from 'fabric'
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
 * quelle.
 *
 * Le double du `Textbox` reproduit **les deux** mouvements de Fabric, pas
 * seulement celui qui arrange : `initDimensions` gonfle, et `set` relance
 * `initDimensions` parce que `width` est déclarée dans `textLayoutProperties`.
 * Un double qui n'aurait fait qu'assigner aurait validé une restauration qui
 * rebondit — c'est exactement ce qu'une première version de ce fichier a fait.
 */
function bumpedTextbox(options: {
  declaredWidth: number
  measuredWidth: number
  measuredHeight?: number
  scaleX?: number
  grouped?: boolean
}): Textbox & RenderedObject {
  const box = Object.create(Textbox.prototype) as Textbox & RenderedObject
  let centerX = 500
  let centerY = 400
  box.data = { declaredWidth: options.declaredWidth }
  box.width = options.declaredWidth
  box.height = 120
  box.opacity = 1
  box.setCoords = vi.fn()
  // Ce que fait Fabric quand un mot ne tient pas dans la boîte.
  const bump = () => {
    if (options.measuredWidth > box.width) box.width = options.measuredWidth
    if (options.measuredHeight !== undefined) box.height = options.measuredHeight
  }
  box.initDimensions = bump
  // `FabricText.set` : toute propriété de mise en page relance `initDimensions`.
  box.set = vi.fn((props: Record<string, unknown>) => {
    Object.assign(box, props)
    if (typeof props.left === 'number') centerX = props.left
    if (typeof props.top === 'number') centerY = props.top
    if ('width' in props) bump()
    return box
  }) as unknown as Textbox['set']
  // `_set` écrit sans relancer la mise en page — c'est ce que Fabric emploie
  // lui-même pour poser `dynamicMinWidth`.
  Object.assign(box, {
    _set: (key: string, value: unknown) => {
      Object.assign(box, { [key]: value })
    },
  })
  box.getCenterPoint = () => new Point(centerX, centerY)
  box.calcTransformMatrix = () => [options.scaleX ?? 1, 0, 0, 1, centerX, centerY]
  if (options.grouped) {
    box.group = {} as RenderedObject['group']
    box.setXY = vi.fn((point: Point) => {
      centerX = point.x
      centerY = point.y
      return box
    }) as unknown as Textbox['setXY']
  }
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

  it('conserve le coin supérieur gauche quand la hauteur mesurée change', () => {
    const box = bumpedTextbox({
      declaredWidth: 320,
      measuredWidth: 512,
      measuredHeight: 200,
    })
    const before = fabricObjectToLayerUpdate(box)

    rewrapTextbox(box)

    expect(fabricObjectToLayerUpdate(box)).toMatchObject({ x: before.x, y: before.y })
  })

  it('ne repositionne pas la boîte quand sa hauteur ne change pas', () => {
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512 })

    rewrapTextbox(box)

    expect(box.set).not.toHaveBeenCalled()
  })

  it('compense en coordonnées de scène dans une sélection multiple', () => {
    const box = bumpedTextbox({
      declaredWidth: 320,
      measuredWidth: 512,
      measuredHeight: 200,
      grouped: true,
    })
    const before = fabricObjectToLayerUpdate(box)

    rewrapTextbox(box)

    expect(box.setXY).toHaveBeenCalledWith(new Point(500, 440), 'center', 'center')
    expect(fabricObjectToLayerUpdate(box)).toMatchObject({ x: before.x, y: before.y })
  })

  it('laisse Fabric décider quand le calque ne déclare rien', () => {
    const box = bumpedTextbox({ declaredWidth: 320, measuredWidth: 512 })
    box.data = {}

    rewrapTextbox(box)

    expect(box.width).toBe(512)
  })

  /**
   * La raison d'employer `_set` vit chez Fabric, pas dans un commentaire : si
   * une mise à jour retire `width` de cette liste, `set` redevient utilisable et
   * ce test le dira. S'il la garde, il interdit d'y revenir par inadvertance.
   */
  it('constate que Fabric relance la mise en page sur un set de width', () => {
    expect(Textbox.textLayoutProperties).toContain('width')
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
