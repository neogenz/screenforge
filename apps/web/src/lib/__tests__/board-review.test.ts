import { describe, expect, it } from 'vitest'
import { reviewBoard, type BoardFindingKind } from '@/lib/ai/board-review'
import { PLAN_BOARD } from '@/lib/ai/archetypes'
import { planFromBrief, planToolCalls } from '@/lib/ai/plan'
import { applyToolCalls } from '@/lib/ai/tools'
import { DEFAULT_GLOBALS } from '@/stores/project.store'
import type { TextMeasure } from '@/lib/locale'
import type { CampaignBrief } from '@/lib/ai/plan'
import type {
  Background,
  DeviceFrameLayer,
  Layer,
  Project,
  Screen,
  ShapeLayer,
  TextLayer,
} from '@/types'

/**
 * Les six mesures, chacune sur un défaut posé exprès.
 *
 * Les chiffres viennent de la session mesurée du 2026-08-16 : une boîte de
 * 215 px pour cinq lignes, un appareil à 56 % sur la planche, deux accroches
 * qui se recouvrent. Un seuil qu'aucun test ne touche redevient une opinion, et
 * c'est exactement ce que le générateur local a appris à ses dépens.
 *
 * La mesure est injectée : une largeur dépendante d'une police chargée
 * mesurerait le repli du navigateur, jamais la composition. Six pixels par
 * caractère, ce qui rend chaque attente calculable à la main.
 */
const measure: TextMeasure = (text) => text.length * 6

function textLayer(over: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 'l1',
    type: 'text',
    name: 'Accroche',
    x: 40,
    y: 40,
    width: 360,
    height: 120,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    content: 'Vois plus loin',
    fontFamily: 'Inter',
    fontSize: 32,
    fontWeight: 700,
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.2,
    letterSpacing: 0,
    textTransform: 'none',
    ...over,
  }
}

function deviceLayer(over: Partial<DeviceFrameLayer> = {}): DeviceFrameLayer {
  return {
    id: 'd1',
    type: 'device-frame',
    name: 'iPhone',
    x: 70,
    y: 300,
    width: 300,
    height: 600,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 1,
    deviceModel: 'iphone-17-pro-max',
    deviceColor: 'silver',
    orientation: 'portrait',
    placement: { mode: 'cover', focusX: 0.5, focusY: 0.5, zoom: 1 },
    ...over,
  }
}

function shapeLayer(over: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: 'sh1',
    type: 'shape',
    name: 'Pastille',
    x: 30,
    y: 30,
    width: 380,
    height: 140,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    shapeType: 'rectangle',
    fill: '#101010',
    ...over,
  }
}

function screen(
  layers: Layer[],
  background: Background = { type: 'solid', color: '#101010' },
): Screen {
  return { id: 's1', name: 'Écran 1', layers, background }
}

const kinds = (findings: { kind: BoardFindingKind }[]) => findings.map((finding) => finding.kind)

describe('le constat d’une planche', () => {
  it('ne signale rien sur une planche que le générateur local a composée', () => {
    const brief: CampaignBrief = {
      appName: 'Cadence',
      pitch: 'Le suivi de budget qui tient dans une poche',
      direction: 'contraste',
      screenCount: 4,
      deviceModel: 'iphone-17-pro-max',
      screenshots: [{ label: 'Budget' }, { label: 'Réglages' }],
    }
    const draft: Project = {
      id: 'p1',
      name: 'Projet',
      target: 'app-store-iphone',
      screens: [],
      activeScreenId: '',
      globals: structuredClone(DEFAULT_GLOBALS),
      layoutLayers: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const outcome = applyToolCalls(draft, planToolCalls(planFromBrief(brief), brief))
    expect(outcome.error).toBeUndefined()
    expect(draft.screens.length).toBeGreaterThan(0)

    /* Le générateur et la revue doivent lire la même règle. S'ils divergent,
       c'est ici que ça se voit, et pas dans la session d'un utilisateur. */
    for (const board of draft.screens) {
      expect(reviewBoard(board, draft.layoutLayers, measure), board.name).toEqual([])
    }
  })

  it('mesure un texte plus haut que sa boîte', () => {
    // 4 lignes × 32 × 1.2 = 153,6 px de texte dans une boîte de 40.
    const long = textLayer({
      content: 'Vois beaucoup plus loin que ce que la boîte accepte de tenir',
      width: 120,
      height: 40,
    })
    const findings = reviewBoard(screen([long]), [], measure)
    const overflow = findings.find((finding) => finding.kind === 'overflow')
    expect(overflow?.detail).toMatch(/Accroche/)
    expect(overflow?.detail).toMatch(/boîte de 40 px/)
  })

  it('mesure un appareil décapité, et laisse passer un cadrage serré', () => {
    // 300 × 600 posé à y = 600 : 356 px de haut restent, soit 59 %.
    const cropped = reviewBoard(screen([deviceLayer({ y: 600 })]), [], measure)
    expect(kinds(cropped)).toContain('device-cropped')
    expect(cropped.find((finding) => finding.kind === 'device-cropped')?.detail).toMatch(/59 %/)

    // 80 % sur la planche : au-dessus du seuil d'alerte, sous les 90 % que le
    // générateur s'impose. Une composition à la main n'est pas un plan généré.
    const tight = reviewBoard(screen([deviceLayer({ y: 476 })]), [], measure)
    expect(kinds(tight)).not.toContain('device-cropped')
  })

  it('mesure le contraste sur chaque arrêt du fond, pas seulement le premier', () => {
    const gradient: Background = {
      type: 'linear-gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#101010' },
        { offset: 1, color: '#f4f4f4' },
      ],
    }
    const findings = reviewBoard(screen([textLayer()], gradient), [], measure)
    const contrast = findings.filter((finding) => finding.kind === 'contrast')
    // Blanc sur #101010 passe ; blanc sur #f4f4f4 ne passe pas.
    expect(contrast).toHaveLength(1)
    expect(contrast[0].detail).toMatch(/#f4f4f4/)
  })

  it('signale deux textes superposés, jamais une forme sous une accroche', () => {
    // Les deux morceaux de la session mesurée : 38→238 et 160→360.
    const left = textLayer({ id: 'a', name: 'Vois', x: 38, width: 200, y: 40, height: 60 })
    const right = textLayer({ id: 'b', name: 'plus', x: 160, width: 200, y: 40, height: 60 })
    const overlapped = reviewBoard(screen([left, right]), [], measure)
    const overlap = overlapped.find((finding) => finding.kind === 'overlap')
    expect(overlap?.detail).toMatch(/Vois/)
    expect(overlap?.detail).toMatch(/plus/)

    /* Une pastille de lisibilité sous une accroche est ce que
       `texte-sur-appareil` pose exprès : la signaler ferait du constat un
       bruit qu'on apprend à ignorer. */
    const composed = reviewBoard(screen([shapeLayer(), textLayer()]), [], measure)
    expect(kinds(composed)).not.toContain('overlap')
  })

  it('mesure une boîte qui sort du cadre, en nommant le côté', () => {
    const findings = reviewBoard(screen([textLayer({ x: PLAN_BOARD.width - 60 })]), [], measure)
    const off = findings.find((finding) => finding.kind === 'off-canvas')
    expect(off?.detail).toMatch(/à droite/)
  })

  it('mesure une bande vide de plus d’un quart de planche', () => {
    // Un seul bandeau en haut : 956 − 160 = 796 px de vide, soit bien plus que 239.
    const findings = reviewBoard(screen([textLayer({ y: 40, height: 120 })]), [], measure)
    const band = findings.find((finding) => finding.kind === 'empty-band')
    expect(band?.detail).toMatch(/796 px/)
    expect(band?.layerId).toBeUndefined()
  })

  it('compte les calques partagés, et ignore ce qui est masqué', () => {
    const shared = textLayer({ id: 'shared', name: 'Titre commun', height: 20 })
    expect(kinds(reviewBoard(screen([]), [shared], measure))).toContain('overflow')

    const hidden = textLayer({ id: 'hidden', visible: false, height: 20 })
    expect(kinds(reviewBoard(screen([hidden]), [], measure))).not.toContain('overflow')
  })
})
