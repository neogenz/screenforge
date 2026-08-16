import { describe, expect, it } from 'vitest'
import { ICON_IDS, SHAPE_IDS } from '@screenforge/project-format/catalog-ids'
import {
  ICON_CATALOG,
  SHAPE_CATALOG,
  groupsOf,
  iconEntry,
  isIconId,
  isShapeId,
  shapeEntry,
} from '@/lib/vector-catalog'

/**
 * Le catalogue est un contrat de persistance : un identifiant écrit dans un
 * projet doit encore résoudre demain. Ce qui se vérifie ici est sa forme ; que
 * chaque tracé tienne dans sa boîte se mesure dans un vrai moteur SVG, par
 * `e2e/vector-catalog.spec.ts`.
 */

const COMMANDS = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/

describe('catalogue des vecteurs', () => {
  it('n’a aucun identifiant en double', () => {
    const shapeIds = SHAPE_CATALOG.map((entry) => entry.id)
    const iconIds = ICON_CATALOG.map((entry) => entry.id)
    expect(new Set(shapeIds).size).toBe(shapeIds.length)
    expect(new Set(iconIds).size).toBe(iconIds.length)
  })

  it('résout ce qu’il déclare, et rien d’autre', () => {
    for (const entry of SHAPE_CATALOG) expect(shapeEntry(entry.id)).toBe(entry)
    for (const entry of ICON_CATALOG) expect(iconEntry(entry.id)).toBe(entry)
    expect(shapeEntry('hexagone')).toBeUndefined()
    expect(isShapeId('hexagone')).toBe(false)
    expect(isIconId('__proto__')).toBe(false)
    expect(isShapeId('rectangle')).toBe(true)
    expect(isIconId('star')).toBe(true)
  })

  it('commence chaque tracé par un déplacement absolu', () => {
    /* Les sous-tracés sont concaténés en un seul `d` : un `m` relatif en tête
       repartirait du point courant du sous-tracé précédent au lieu de
       l'origine, et l'icône se disloquerait. */
    const paths = [
      ...SHAPE_CATALOG.flatMap((entry) => (entry.path ? [entry.path] : [])),
      ...ICON_CATALOG.map((entry) => entry.path),
    ]
    expect(paths.length).toBeGreaterThan(40)
    for (const path of paths) {
      expect(path.startsWith('M')).toBe(true)
      expect(path).toMatch(COMMANDS)
      expect(path).not.toContain('NaN')
      expect(path).not.toContain('undefined')
    }
  })

  it('nomme et groupe chaque entrée', () => {
    for (const entry of [...SHAPE_CATALOG, ...ICON_CATALOG]) {
      expect(entry.label.length).toBeGreaterThan(1)
      expect(entry.group.length).toBeGreaterThan(1)
    }
  })

  it('garde les groupes dans l’ordre du catalogue', () => {
    const groups = groupsOf(SHAPE_CATALOG)
    expect(groups.map(([name]) => name)).toEqual(['Base', 'Géométrie', 'Accent', 'Direction'])
    expect(groups.flatMap(([, items]) => items)).toEqual([...SHAPE_CATALOG])
  })

  it('couvre exactement les identifiants du contrat partagé', () => {
    /* Un identifiant déclaré dans `@screenforge/project-format` sans tracé ici
       serait accepté par la validation du projet puis rendu en forme de
       secours — la liste et le catalogue ne doivent jamais diverger. */
    expect(SHAPE_CATALOG.map((entry) => entry.id)).toEqual([...SHAPE_IDS])
    expect(ICON_CATALOG.map((entry) => entry.id)).toEqual([...ICON_IDS])
  })

  it('laisse les primitives Fabric sans tracé', () => {
    const untraced = SHAPE_CATALOG.filter((entry) => !entry.path).map((entry) => entry.id)
    expect(untraced).toEqual(['rectangle', 'rounded-rect', 'circle'])
  })
})
