import { describe, expect, it } from 'vitest'
import {
  ARCHETYPE_IDS,
  archetypeSpec,
  assignArchetypes,
  automaticArchetype,
  backgroundFor,
  composeArchetype,
  onBoardRatio,
  PLAN_BOARD,
  SAFE_ARCHETYPE_IDS,
  tallestEmptyBand,
  type ArchetypeId,
} from '@/lib/ai/archetypes'
import { DEVICE_FRAMES, getDefaultDeviceSize } from '@/assets/device-frames'
import { contrastRatio, type Palette } from '@/lib/ai/palette'
import { DIRECTIONS, planFromBrief, planScreenLayout, planToolCalls } from '@/lib/ai/plan'
import { validateToolCall } from '@/lib/ai/tools'
import type { CampaignBrief } from '@/lib/ai/plan'
import type { DeviceModel } from '@/types'

/**
 * Les règles de composition, en assertions plutôt qu'en prose.
 *
 * Shotluma énonce les siennes dans un prompt et charge un modèle de les relire
 * sur une image rendue. Ici personne ne regarde d'image : ce qui les tient est
 * ce fichier. Chacune des cinq est celle d'un défaut constaté — dix planches
 * identiques, une accroche illisible sur un fond d'accent, un appareil décapité,
 * une moitié de planche vide.
 */

/* Les vrais rapports de cadre, pas une valeur plausible : la marge du débord
   se joue au centième, et un modèle un peu plus étroit décapiterait l'appareil
   sans qu'un test écrit sur 0,46 ne s'en aperçoive. */
const MODELS: DeviceModel[] = DEVICE_FRAMES.map((frame) => frame.model)
const ASPECTS = MODELS.map((model) => {
  const frame = getDefaultDeviceSize(model)
  return frame.width / frame.height
})

const PALETTES: Palette[] = DIRECTIONS.map((entry) => ({
  background: entry.background,
  ink: entry.ink,
  accent: entry.accent,
}))

function layoutOf(id: ArchetypeId, palette: Palette, index = 0, deviceAspect = ASPECTS[0]) {
  return composeArchetype(id, {
    palette,
    background: backgroundFor(id, palette),
    headline: 'Vos dépenses, enfin lisibles',
    deviceAspect,
    index,
  })
}

describe('l’assignation des archétypes', () => {
  it('ne met jamais deux planches voisines sur la même composition', () => {
    for (let count = 1; count <= 10; count += 1) {
      const assigned = assignArchetypes(count)
      for (let at = 1; at < assigned.length; at += 1) {
        expect(assigned[at], `lot de ${count}, rang ${at}`).not.toBe(assigned[at - 1])
      }
    }
  })

  it('en emploie au moins trois différents dès trois planches', () => {
    for (let count = 3; count <= 10; count += 1) {
      expect(new Set(assignArchetypes(count)).size, `lot de ${count}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('ouvre sur une composition sûre', () => {
    for (let count = 1; count <= 10; count += 1) {
      const assigned = assignArchetypes(count)
      expect(assigned[0]).toBe('plein-cadre')
      expect(assigned.every((id) => SAFE_ARCHETYPE_IDS.includes(id))).toBe(true)
    }
  })

  it('ne remplace jamais une capture disponible par un mur', () => {
    for (let count = 4; count <= 10; count += 1) {
      expect(assignArchetypes(count)).not.toContain('mur')
    }
    expect(automaticArchetype(3, 4, false)).toBe('mur')
    expect(automaticArchetype(3, 4, true)).not.toBe('mur')
  })

  it('rend le même lot deux fois : la revue ne prouve rien si elle tire au sort', () => {
    expect(assignArchetypes(7)).toEqual(assignArchetypes(7))
  })
})

describe('chaque composition', () => {
  it('garde l’accroche lisible sur son fond, dégradé et accent compris', () => {
    for (const palette of PALETTES) {
      for (const id of ARCHETYPE_IDS) {
        const background = backgroundFor(id, palette)
        const colors =
          background.type === 'solid'
            ? [background.color]
            : background.stops.map((stop) => stop.color)
        const { headline } = layoutOf(id, palette)
        for (const color of colors) {
          expect(contrastRatio(color, headline.color), `${id} sur ${color}`).toBeGreaterThanOrEqual(
            4.5,
          )
        }
      }
    }
  })

  it('laisse au moins 90 % de l’appareil automatique dans le cadre', () => {
    for (const id of SAFE_ARCHETYPE_IDS) {
      for (const [at, aspect] of ASPECTS.entries()) {
        const { device } = layoutOf(id, PALETTES[0], 0, aspect)
        if (!device) continue
        expect(onBoardRatio(device), `${id} sur ${MODELS[at]}`).toBeGreaterThanOrEqual(0.9)
      }
    }
  })

  it('ne laisse pas un quart de planche en fond nu', () => {
    /* « If more than about a quarter of the canvas ends up as one
       uninterrupted stretch of empty background, treat it as a defect. » */
    const limit = PLAN_BOARD.height / 4
    for (const id of ARCHETYPE_IDS) {
      for (const [at, aspect] of ASPECTS.entries()) {
        expect(
          tallestEmptyBand(layoutOf(id, PALETTES[0], 0, aspect)),
          `${id} sur ${MODELS[at]}`,
        ).toBeLessThan(limit)
      }
    }
  })

  it('alterne le sens de l’inclinaison d’un rang à l’autre', () => {
    const penche = ARCHETYPE_IDS.filter((id) => layoutOf(id, PALETTES[0], 0).device?.rotation)
    expect(penche.length).toBeGreaterThan(0)
    for (const id of penche) {
      expect(layoutOf(id, PALETTES[0], 0).device?.rotation).toBe(
        -(layoutOf(id, PALETTES[0], 1).device?.rotation ?? 0),
      )
    }
  })

  it('tient l’accroche hors de chaque appareil automatique et réserve le pied', () => {
    for (const id of SAFE_ARCHETYPE_IDS) {
      for (const aspect of ASPECTS) {
        const { headline, device } = layoutOf(id, PALETTES[0], 0, aspect)
        if (!device) continue
        const apart =
          headline.y + headline.height <= device.y || headline.y >= device.y + device.height
        expect(apart, `${id}`).toBe(true)
        expect(Math.abs(device.rotation), `${id}`).toBeLessThanOrEqual(2)
        expect(device.y + device.height, `${id}`).toBeLessThanOrEqual(PLAN_BOARD.height - 72)
      }
    }
  })

  it('donne à la boîte d’accroche la hauteur que son corps demande', () => {
    /* `locale.ts` mesure en lignes × corps × interligne, et la revue des langues
       signale un dépassement sur la langue d'origine : une boîte déclarée à
       part du corps finit par ne plus l'accorder. Elle a débordé une fois. */
    for (const id of ARCHETYPE_IDS) {
      const spec = archetypeSpec(id)
      const { headline } = layoutOf(id, PALETTES[0])
      expect(headline.height, `${id}`).toBe(
        Math.round(spec.headline.lines * headline.fontSize * 1.2),
      )
      expect(spec.headline.lines).toBeGreaterThanOrEqual(3)
    }
  })

  it('pose une pastille sous une accroche qui chevauche l’appareil', () => {
    const overlapping = layoutOf('texte-sur-appareil', PALETTES[0])
    expect(overlapping.accentsFront).toHaveLength(1)
    // Elle couvre le bloc de texte, sinon elle ne garantit rien.
    const pill = overlapping.accentsFront[0]
    expect(pill.x).toBeLessThanOrEqual(overlapping.headline.x)
    expect(pill.y).toBeLessThanOrEqual(overlapping.headline.y)
    expect(pill.x + pill.width).toBeGreaterThanOrEqual(
      overlapping.headline.x + overlapping.headline.width,
    )
  })
})

describe('le lot composé', () => {
  const brief: CampaignBrief = {
    appName: 'Cadence',
    pitch: 'Le suivi de budget qui tient dans une poche',
    direction: 'nocturne',
    screenCount: 6,
    deviceModel: 'iphone-17-pro-max',
    screenshots: [{ label: 'Budget' }, { label: 'Réglages' }],
  }

  it('ne montre pas deux fois la même image dans la revue', () => {
    const plan = planFromBrief(brief)
    const signatures = plan.screens.map((_unused, index) => {
      const layout = planScreenLayout(plan, brief, index)
      return JSON.stringify([
        layout?.archetype,
        layout?.device?.x,
        layout?.device?.y,
        layout?.device?.rotation,
        layout?.headline.y,
      ])
    })
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(3)
  })

  it('ne rejoint le projet que par des appels que le schéma accepte', () => {
    const calls = planToolCalls(planFromBrief(brief), brief)
    for (const call of calls) expect(validateToolCall(call)).toBeNull()
    // Les formes d'accent et l'inclinaison sont bien parties, pas seulement prévues.
    expect(calls.some((call) => call.tool === 'add_shape')).toBe(true)
    expect(calls.some((call) => call.tool === 'add_device' && call.args.rotation !== 0)).toBe(true)
  })

  it('pose l’accroche en dernier sur chaque planche : rien ne la recouvre', () => {
    const calls = planToolCalls(planFromBrief(brief), brief)
    const boards = calls.reduce<string[][]>((groups, call) => {
      if (call.tool === 'add_screen') groups.push([])
      if (groups.length > 0) groups[groups.length - 1].push(call.tool)
      return groups
    }, [])
    expect(boards).toHaveLength(brief.screenCount)
    for (const board of boards) expect(board[board.length - 1]).toBe('add_text')
  })

  it('laisse la planche de clôture sans appareil', () => {
    const plan = planFromBrief(brief)
    const last = planScreenLayout(plan, brief, brief.screenCount - 1)
    expect(last?.archetype).toBe('mur')
    expect(last?.device).toBeUndefined()
  })

  it('conserve la dernière capture d’un lot complet au lieu de forcer un mur', () => {
    const fullBrief: CampaignBrief = {
      ...brief,
      screenCount: 4,
      screenshots: Array.from({ length: 4 }, (_unused, index) => ({
        label: `Capture ${index + 1}`,
        assetId: `asset-${index + 1}`,
        size: { width: 1320, height: 2868 },
      })),
    }
    const plan = planFromBrief(fullBrief)
    expect(plan.screens[3]).toMatchObject({ screenshotIndex: 3 })
    expect(plan.screens[3].layout).not.toBe('mur')
    expect(planScreenLayout(plan, fullBrief, 3)?.device?.assetId).toBe('asset-4')
  })
})
