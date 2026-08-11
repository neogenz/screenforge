import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { isBackground } from '@/lib/project-validation'
import { normalizeSlot } from '@/lib/slots'
import { AI_LIMITS, type ToolCall } from '@/lib/ai/tools'
import type { Background, DeviceModel, ScreenshotSize } from '@/types'

/**
 * Le plan de campagne : ce qui sera fait, avant que quoi que ce soit ne le soit.
 *
 * Il existe pour être **relu**. Une génération qui écrit directement dans le
 * projet demande à l'utilisateur de juger dix écrans déjà posés ; un plan tient
 * en une page, se corrige, se refuse, et ne coûte rien à jeter. C'est aussi la
 * seule forme que les deux moitiés du produit partagent : le planificateur
 * local et un fournisseur distant rendent le même objet, et le constructeur ne
 * sait pas lequel des deux a parlé.
 */

export interface BriefScreenshot {
  /** Ce que l'utilisateur reconnaît : « Budget », « Réglages ». */
  label: string
  assetId?: string
  size?: ScreenshotSize
}

export interface CampaignBrief {
  appName: string
  /** Une phrase : ce que l'application fait. Sert à composer les accroches. */
  pitch: string
  direction: DirectionId
  deviceModel: DeviceModel
  screenshots: BriefScreenshot[]
  /** Le logo de l'application, posé sur la première planche s'il est fourni. */
  logo?: { assetId: string; size: ScreenshotSize }
}

export interface PlannedScreen {
  name: string
  headline: string
  slot?: string
  background: Background
  /** Index dans `brief.screenshots`, quand une capture nourrit cette planche. */
  screenshotIndex?: number
}

export interface CampaignPlan {
  appName: string
  direction: DirectionId
  deviceModel: DeviceModel
  screens: PlannedScreen[]
}

/**
 * Quatre directions, pas un nuancier.
 *
 * Une direction visuelle choisie dans une liste courte se juge d'un coup d'œil
 * et se rejoue à l'identique à la release suivante. Les valeurs sont des hex
 * littéraux et non des jetons du thème : elles partent sur la planche exportée,
 * pas dans le chrome, et une planche ne change pas de couleur parce que
 * l'utilisateur a basculé son éditeur en clair.
 */
export const DIRECTIONS = [
  { id: 'sobre', label: 'Sobre', background: '#f2f3f5', ink: '#141413', accent: '#3d5afe' },
  { id: 'contraste', label: 'Contrasté', background: '#101114', ink: '#ffffff', accent: '#c6ff4f' },
  {
    id: 'chaleureux',
    label: 'Chaleureux',
    background: '#fff1e6',
    ink: '#3b2415',
    accent: '#ff7043',
  },
  { id: 'nocturne', label: 'Nocturne', background: '#1b1f3b', ink: '#eef1ff', accent: '#7c9cff' },
] as const

export type DirectionId = (typeof DIRECTIONS)[number]['id']

export function direction(id: DirectionId): (typeof DIRECTIONS)[number] {
  return DIRECTIONS.find((entry) => entry.id === id) ?? DIRECTIONS[0]
}

function isDirectionId(value: unknown): value is DirectionId {
  return DIRECTIONS.some((entry) => entry.id === value)
}

/**
 * L'accroche que le planificateur local écrit, faute de modèle.
 *
 * Elle nomme la capture, ce qu'une accroche de campagne fait toujours, et elle
 * est éditable dès la seconde suivante. Prétendre écrire la publicité à la
 * place de l'utilisateur serait mentir sur ce que cette moitié du produit sait
 * faire.
 */
function headlineFor(shot: BriefScreenshot, brief: CampaignBrief): string {
  return shot.label.trim() || brief.pitch.trim() || brief.appName
}

/**
 * Compose un plan sans modèle : une planche par capture, la direction choisie,
 * un rôle dérivé du libellé.
 *
 * Sans aucune capture, il reste une planche — celle de l'accroche : une
 * campagne commencée à vide est une campagne quand même, et l'utilisateur
 * posera ses captures après. Rendre un plan vide aurait laissé le bouton
 * « Poser » sans rien à poser.
 *
 * C'est la voie par défaut du produit — hors ligne, gratuite, déterministe — et
 * la référence à laquelle un fournisseur distant est comparé.
 */
export function planFromBrief(brief: CampaignBrief): CampaignPlan {
  const palette = direction(brief.direction)
  const shots = brief.screenshots.slice(0, AI_LIMITS.maxScreens)
  const screens: PlannedScreen[] = (shots.length > 0 ? shots : [{ label: '' }]).map(
    (shot, index) => ({
      name: shot.label.trim() || brief.appName,
      headline: headlineFor(shot, brief),
      slot: normalizeSlot(shot.label.trim() || brief.appName || `ecran-${index + 1}`),
      background: { type: 'solid', color: palette.background },
      screenshotIndex: shot.assetId ? index : undefined,
    }),
  )
  return {
    appName: brief.appName,
    direction: brief.direction,
    deviceModel: brief.deviceModel,
    screens,
  }
}

/** Le plan rendu par un fournisseur est une entrée non fiable comme une autre. */
export function isCampaignPlan(value: unknown): value is CampaignPlan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  if (typeof plan.appName !== 'string' || !isDirectionId(plan.direction)) return false
  if (typeof plan.deviceModel !== 'string') return false
  if (!Array.isArray(plan.screens) || plan.screens.length === 0) return false
  if (plan.screens.length > AI_LIMITS.maxScreens) return false
  return plan.screens.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const screen = entry as Record<string, unknown>
    if (typeof screen.name !== 'string' || screen.name.length > AI_LIMITS.maxNameLength)
      return false
    if (typeof screen.headline !== 'string' || screen.headline.length > AI_LIMITS.maxTextLength) {
      return false
    }
    if (screen.slot !== undefined && typeof screen.slot !== 'string') return false
    /* Le contrat du projet, pas « c'est un objet ». `{}` et
       `{type: 'arc-en-ciel'}` passaient ici, s'affichaient comme un plan
       valide, et n'échouaient qu'au clic sur « Poser » — sur le message
       générique du contrat de projet, qui ne dit pas quel fond est en cause.
       Rien n'était jamais écrit, mais l'erreur désignait le mauvais endroit. */
    if (!isBackground(screen.background)) return false
    return screen.screenshotIndex === undefined || typeof screen.screenshotIndex === 'number'
  })
}

const HEADLINE_WIDTH = SCREEN_WIDTH - 64
const HEADLINE_TOP = 96
const LOGO_TOP = 32
const LOGO_HEIGHT = 48
const DEVICE_TOP = 300

/**
 * Traduit le plan en appels d'outils — la seule route vers le projet.
 *
 * Le plan ne pose rien lui-même : il devient la même suite d'appels qu'un
 * modèle aurait dû produire, et passe par le même exécuteur, les mêmes bornes
 * et la même validation. Une seule voie d'écriture veut dire une seule surface
 * à auditer.
 */
export function planToolCalls(plan: CampaignPlan, brief: CampaignBrief): ToolCall[] {
  const palette = direction(plan.direction)
  const calls: ToolCall[] = [
    {
      tool: 'declare_plan',
      args: {
        summary: `${plan.appName} — ${plan.screens.length} planches, direction « ${palette.label} »`,
        screens: plan.screens.map((screen) => ({
          name: screen.name,
          headline: screen.headline,
          ...(screen.slot ? { slot: screen.slot } : {}),
        })),
      },
    },
  ]

  for (const [index, screen] of plan.screens.entries()) {
    calls.push({ tool: 'add_screen', args: { name: screen.name } })
    calls.push({ tool: 'set_background', args: { background: screen.background } })

    /* Le logo n'est posé que sur la première planche : répété dix fois il
       devient un filigrane, et c'est la planche d'ouverture qui doit dire de
       quelle application il s'agit. */
    if (index === 0 && brief.logo) {
      const height = LOGO_HEIGHT
      const width = Math.max(
        1,
        Math.round((brief.logo.size.width / brief.logo.size.height) * height),
      )
      calls.push({
        tool: 'add_image',
        args: {
          assetId: brief.logo.assetId,
          originalWidth: brief.logo.size.width,
          originalHeight: brief.logo.size.height,
          name: `Logo ${plan.appName}`.slice(0, 60),
          x: Math.round((SCREEN_WIDTH - width) / 2),
          y: LOGO_TOP,
          width,
          height,
        },
      })
    }

    calls.push({
      tool: 'add_text',
      args: {
        content: screen.headline,
        x: 32,
        y: HEADLINE_TOP,
        width: HEADLINE_WIDTH,
        height: 120,
        color: palette.ink,
        textAlign: 'center',
      },
    })

    const shot =
      screen.screenshotIndex === undefined ? undefined : brief.screenshots[screen.screenshotIndex]
    calls.push({
      tool: 'add_device',
      args: {
        deviceModel: plan.deviceModel,
        y: DEVICE_TOP,
        ...(screen.slot ? { slot: screen.slot } : {}),
        ...(shot?.assetId && shot.size
          ? {
              assetId: shot.assetId,
              screenshotWidth: shot.size.width,
              screenshotHeight: shot.size.height,
            }
          : {}),
      },
    })
  }

  return calls
}

/**
 * Applique la direction visuelle à un écran déjà composé.
 *
 * C'est la retouche du planificateur local : elle ne crée rien, elle
 * harmonise — le fond, l'encre des textes, la teinte des formes et des icônes.
 * Tous les appels sont bornés à l'écran visé, et l'exécuteur le revérifie.
 */
export function restyleCalls(
  screenLayers: readonly { id: string; type: string; locked: boolean }[],
  directionId: DirectionId,
): ToolCall[] {
  const palette = direction(directionId)
  const calls: ToolCall[] = [
    { tool: 'set_background', args: { background: { type: 'solid', color: palette.background } } },
  ]
  for (const layer of screenLayers) {
    if (layer.locked) continue
    if (layer.type === 'text') {
      calls.push({
        tool: 'update_layer',
        args: { layerId: layer.id, patch: { color: palette.ink } },
      })
    }
    if (layer.type === 'icon') {
      calls.push({
        tool: 'update_layer',
        args: { layerId: layer.id, patch: { color: palette.accent } },
      })
    }
    if (layer.type === 'shape') {
      calls.push({
        tool: 'update_layer',
        args: { layerId: layer.id, patch: { fill: palette.accent } },
      })
    }
  }
  return calls
}

/** Bornes de la planche, exposées au plan pour que rien ne sorte du cadre. */
export const PLAN_CANVAS = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } as const
