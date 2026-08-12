import { getDefaultDeviceSize } from '@/assets/device-frames'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { backgroundToCss } from '@/lib/background-css'
import { normalizeSlot } from '@/lib/slots'
import { AI_LIMITS, type ToolCall } from '@/lib/ai/tools'
import {
  automaticArchetype,
  backgroundFor,
  composeArchetype,
  headlineLineCount,
  isArchetypeId,
  SAFE_ARCHETYPE_IDS,
  type ArchetypeId,
  type ArchetypeLayout,
  type PlanAccent,
  type PlanBox,
  type PlanDevice,
} from '@/lib/ai/archetypes'
import type { Palette } from '@/lib/ai/palette'
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
  /** Ce que la capture prouve, sans envoyer ses pixels au modèle. */
  description?: string
  assetId?: string
  size?: ScreenshotSize
}

export interface CampaignBrief {
  appName: string
  /** Une phrase : ce que l'application fait. Sert à composer les accroches. */
  pitch: string
  /**
   * La page du produit, si elle existe. Elle ne part que vers un modèle branché
   * et n'est jamais chargée par l'onglet : lire une URL arbitraire depuis la
   * page ferait de ScreenForge un client HTTP au service de ce qu'on lui donne.
   */
  landingUrl?: string
  /** Faits relus par l'utilisateur. L'URL ci-dessus reste une provenance. */
  productContext?: string
  direction: DirectionId
  /** La palette lue dans les captures, quand l'utilisateur l'a demandée. */
  palette?: Palette
  /**
   * Combien de visuels composer. Découplé du nombre de captures : l'App Store
   * en accepte dix, un lot en compte souvent plus que l'on n'a de captures
   * prêtes, et les visuels en trop sont composés sans appareil rempli.
   */
  screenCount: number
  deviceModel: DeviceModel
  screenshots: BriefScreenshot[]
  /** Le logo de l'application, posé sur le premier visuel s'il est fourni. */
  logo?: { assetId: string; size: ScreenshotSize }
}

/**
 * Ce qu'un visuel porte : des mots, un rôle, une capture. Pas un fond.
 *
 * Le fond est résolu par `planScreenLayout` au moment où il est lu (voir le
 * commentaire là-bas). Le laisser aussi ici en ferait deux vérités dont l'une
 * vieillit dès qu'on retire un visuel de la revue.
 */
export interface PlannedScreen {
  name: string
  headline: string
  slot?: string
  /** Index dans `brief.screenshots`, quand une capture nourrit cette planche. */
  screenshotIndex?: number
  /** Extrait exact du brief qui justifie l'accroche distante. */
  evidence?: string
  /** Composition choisie et relue avant insertion. */
  layout: ArchetypeId
}

export interface CampaignPlan {
  appName: string
  direction: DirectionId
  /**
   * Les trois couleurs effectivement peintes. Portées par le plan et non
   * relues depuis `direction` : sinon la palette tirée des captures se perdait
   * entre la revue et la pose, et le constructeur repeignait en « Sobre » ce
   * que l'utilisateur venait de valider en bleu.
   */
  palette: Palette
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

const HEX = /^#[0-9a-f]{6}$/i

function isPalette(value: unknown): value is Palette {
  if (typeof value !== 'object' || value === null) return false
  const palette = value as Record<string, unknown>
  return (['background', 'ink', 'accent'] as const).every(
    (key) => typeof palette[key] === 'string' && HEX.test(palette[key]),
  )
}

/**
 * Les trois couleurs du brief : celles lues dans les captures si elles y sont,
 * celles de la direction choisie sinon.
 *
 * Un seul endroit décide, parce que trois appelants les lisaient — le
 * constructeur, la revue, l'harmonisation — et qu'un quatrième qui relirait
 * `direction(brief.direction)` repeindrait sans le savoir par-dessus la palette
 * de l'utilisateur.
 */
export function resolvePalette(brief: { direction: DirectionId; palette?: Palette }): Palette {
  if (brief.palette) return brief.palette
  const preset = direction(brief.direction)
  return { background: preset.background, ink: preset.ink, accent: preset.accent }
}

/**
 * L'accroche que ScreenForge écrit sans modèle : le nom du fichier, ou la
 * phrase du brief pour le premier visuel.
 *
 * Ce n'est pas une accroche publicitaire et l'interface ne le prétend pas. Sans
 * modèle, ScreenForge ne rédige pas — il pose des textes à réécrire, ce qui est
 * déjà tout le travail de mise en page en moins. Inventer une accroche à partir
 * d'un nom d'application donnerait la même phrase creuse sur les dix visuels.
 */
function headlineFor(
  shot: BriefScreenshot | undefined,
  brief: CampaignBrief,
  index: number,
): string {
  const label = shot?.label.trim()
  if (label) return label.slice(0, AI_LIMITS.maxCampaignHeadlineLength)
  // La phrase du brief n'est posée qu'une fois : répétée, elle devient un
  // filigrane que l'utilisateur doit effacer neuf fois.
  if (index === 0 && brief.pitch.trim()) {
    return brief.pitch.trim().slice(0, AI_LIMITS.maxCampaignHeadlineLength)
  }
  return brief.appName.slice(0, AI_LIMITS.maxCampaignHeadlineLength)
}

/**
 * Compose un plan sans modèle : autant de visuels que demandé, la palette
 * choisie, un rôle dérivé du libellé de la capture.
 *
 * Le nombre de visuels commande, pas le nombre de captures. Demander huit
 * visuels avec trois captures est le cas courant — les cinq derniers sont posés
 * avec leur fond et leur accroche, l'appareil restant à remplir plus tard par
 * « Actualiser les captures ». L'inverse (plus de captures que de visuels) garde
 * les premières dans l'ordre choisi.
 *
 * C'est la voie par défaut du produit — hors ligne, gratuite, déterministe — et
 * la référence à laquelle un fournisseur distant est comparé.
 */
export function planFromBrief(brief: CampaignBrief): CampaignPlan {
  const palette = resolvePalette(brief)
  const count = Math.max(1, Math.min(brief.screenCount, AI_LIMITS.maxScreens))
  const screens: PlannedScreen[] = Array.from({ length: count }, (_unused, index) => {
    const shot = brief.screenshots[index]
    const label = shot?.label.trim()
    return {
      name: (label || `${brief.appName} ${index + 1}`.trim()).slice(0, AI_LIMITS.maxNameLength),
      headline: headlineFor(shot, brief, index),
      slot: normalizeSlot(label || `ecran-${index + 1}`),
      screenshotIndex: shot?.assetId ? index : undefined,
      layout: automaticArchetype(index, count, Boolean(shot?.assetId)),
    }
  })
  return {
    appName: brief.appName,
    direction: brief.direction,
    palette,
    deviceModel: brief.deviceModel,
    screens,
  }
}

/** Le plan rendu par un fournisseur est une entrée non fiable comme une autre. */
export function isCampaignPlan(value: unknown): value is CampaignPlan {
  if (typeof value !== 'object' || value === null) return false
  const plan = value as Record<string, unknown>
  if (typeof plan.appName !== 'string' || !isDirectionId(plan.direction)) return false
  if (!isPalette(plan.palette)) return false
  if (typeof plan.deviceModel !== 'string') return false
  if (!Array.isArray(plan.screens) || plan.screens.length === 0) return false
  if (plan.screens.length > AI_LIMITS.maxScreens) return false
  return plan.screens.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const screen = entry as Record<string, unknown>
    if (typeof screen.name !== 'string' || screen.name.length > AI_LIMITS.maxNameLength)
      return false
    if (
      typeof screen.headline !== 'string' ||
      screen.headline.length > AI_LIMITS.maxCampaignHeadlineLength
    ) {
      return false
    }
    if (screen.slot !== undefined && typeof screen.slot !== 'string') return false
    if (screen.evidence !== undefined && typeof screen.evidence !== 'string') return false
    if (!isArchetypeId(screen.layout)) return false
    return screen.screenshotIndex === undefined || typeof screen.screenshotIndex === 'number'
  })
}

const GENERIC_HEADLINES = [
  'essayez et sentez la difference',
  'a votre rythme a votre image',
  'retrouvez tout en un instant',
  'partagez avec ceux qui comptent',
  'rien d important ne vous echappe',
  'votre quotidien enfin plus leger',
] as const

const CLAIM_STOPWORDS = new Set([
  'afin',
  'alors',
  'apres',
  'avant',
  'avec',
  'cette',
  'chaque',
  'comme',
  'dans',
  'depuis',
  'elle',
  'elles',
  'encore',
  'enfin',
  'entre',
  'etre',
  'faire',
  'leur',
  'leurs',
  'mais',
  'meme',
  'moins',
  'notre',
  'nous',
  'plus',
  'pour',
  'quand',
  'rien',
  'sans',
  'seulement',
  'sont',
  'tout',
  'tous',
  'toute',
  'toutes',
  'votre',
  'vous',
])

function normalizedCopy(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function significantTerms(value: string): string[] {
  return normalizedCopy(value)
    .split(' ')
    .filter((term) => term.length >= 4 && !CLAIM_STOPWORDS.has(term))
}

/** Une preuve doit nommer au moins un fait que l'accroche réemploie. */
function claimMatchesEvidence(headline: string, evidence: string): boolean {
  const claimTerms = significantTerms(headline)
  const evidenceTerms = significantTerms(evidence)
  return claimTerms.some((claim) =>
    evidenceTerms.some(
      (fact) =>
        claim === fact ||
        (claim.length >= 5 && fact.length >= 5 && claim.slice(0, 5) === fact.slice(0, 5)),
    ),
  )
}

function words(value: string): string[] {
  return value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? []
}

function evidenceSources(brief: CampaignBrief, screenshotIndex: number | undefined): string[] {
  const shot = screenshotIndex === undefined ? undefined : brief.screenshots[screenshotIndex]
  return [brief.pitch, brief.productContext ?? '', shot?.description ?? ''].filter(Boolean)
}

/** Valide en bloc une proposition distante avant que la revue puisse la recevoir. */
export function validateGeneratedPlan(plan: CampaignPlan, brief: CampaignBrief): string | null {
  const expected = Math.max(1, Math.min(brief.screenCount, AI_LIMITS.maxScreens))
  if (plan.screens.length !== expected) {
    return `Le modèle a rendu ${plan.screens.length} visuel${plan.screens.length > 1 ? 's' : ''} au lieu de ${expected}.`
  }

  const seen = new Set<string>()
  for (const [index, screen] of plan.screens.entries()) {
    const headline = screen.headline.trim()
    const normalized = normalizedCopy(headline)
    const count = words(headline).length
    if (count < 3 || count > 7) {
      return `L’accroche ${index + 1} doit contenir entre 3 et 7 mots.`
    }
    if (seen.has(normalized)) return `L’accroche ${index + 1} répète une autre proposition.`
    seen.add(normalized)
    if (GENERIC_HEADLINES.some((generic) => normalized.includes(generic))) {
      return `L’accroche ${index + 1} est trop générique pour ce produit.`
    }
    const layout = planScreenLayout(plan, brief, index)
    if (
      layout &&
      SAFE_ARCHETYPE_IDS.includes(screen.layout) &&
      headlineLineCount(layout.headline) > 3
    ) {
      return `L’accroche ${index + 1} dépasse trois lignes dans cette mise en page.`
    }
    if (
      screen.screenshotIndex !== undefined &&
      (!Number.isInteger(screen.screenshotIndex) ||
        !brief.screenshots[screen.screenshotIndex]?.assetId)
    ) {
      return `L’accroche ${index + 1} désigne une capture indisponible.`
    }

    const evidence = screen.evidence?.trim()
    const normalizedEvidence = evidence ? normalizedCopy(evidence) : ''
    const grounded =
      normalizedEvidence.length > 0 &&
      claimMatchesEvidence(headline, evidence ?? '') &&
      evidenceSources(brief, screen.screenshotIndex).some((source) =>
        normalizedCopy(source).includes(normalizedEvidence),
      )
    if (!grounded) return `L’accroche ${index + 1} n’est justifiée par aucun fait du brief.`
  }
  return null
}

const LOGO_TOP = 32
const LOGO_HEIGHT = 48
/** Ce que le logo doit laisser entre lui et l'accroche qu'il coiffe. */
const LOGO_GAP = 16

/**
 * Ce qu'un visuel contient et où, avant d'exister.
 *
 * Deux lecteurs en ont besoin et doivent lire les mêmes nombres : le
 * constructeur, qui traduit en appels d'outils, et l'aperçu de la revue, qui
 * dessine la même chose en CSS. Une seconde table de coordonnées dans le
 * composant d'aperçu aurait montré une composition que la pose ne produit pas —
 * une revue qui ment est pire qu'une revue absente, puisqu'on y engage le
 * projet. D'où une fonction, et le constructeur qui la consomme lui aussi.
 *
 * Elle ne calcule plus la composition : elle la **résout**. Les coordonnées
 * viennent de `archetypes.ts`, qui décide de la mise en page ; ce qui reste ici
 * est ce qu'un archétype ne peut pas connaître — quelle capture nourrit cet
 * appareil, où va le logo, quel rang porte quelle composition.
 */
export interface PlanScreenLayout extends ArchetypeLayout {
  archetype: ArchetypeId
  background: Background
  device?: PlanDevice & { assetId?: string; screenshotSize?: ScreenshotSize }
  /** Sur le premier visuel, et sur la planche de clôture quand il y en a une. */
  logo?: PlanBox & { assetId: string; size: ScreenshotSize }
}

/**
 * Le logo, posé au-dessus de l'accroche ou sous elle selon la composition.
 *
 * Deux planches le portent et pas dix : l'ouverture, qui doit dire de quelle
 * application il s'agit, et le mur de clôture, qui n'a que des mots et qu'un
 * logo signe. Répété partout, il devient un filigrane que l'utilisateur efface
 * huit fois.
 */
function logoBox(brief: CampaignBrief, archetype: ArchetypeId): PlanBox | null {
  if (!brief.logo) return null
  const width = Math.max(
    1,
    Math.round((brief.logo.size.width / brief.logo.size.height) * LOGO_HEIGHT),
  )
  const x = Math.round((SCREEN_WIDTH - width) / 2)
  /* Sur le mur, l'accroche occupe le centre : le logo descend en pied plutôt
     que de venir la coiffer là où il n'y a pas la place. */
  const y = archetype === 'mur' ? Math.round(SCREEN_HEIGHT * 0.86) : LOGO_TOP
  return { x, y, width, height: LOGO_HEIGHT }
}

export function planScreenLayout(
  plan: CampaignPlan,
  brief: CampaignBrief,
  index: number,
): PlanScreenLayout | null {
  const screen = plan.screens[index]
  if (!screen) return null

  const archetype = screen.layout
  const frame = getDefaultDeviceSize(plan.deviceModel)
  const shot =
    screen.screenshotIndex === undefined ? undefined : brief.screenshots[screen.screenshotIndex]

  /* Résolu ici, à chaque lecture, et non porté par le visuel : les deux se
     désaccordaient au premier « Retirer » de la revue. Le fond était figé à la
     composition du rang au moment du plan, l'archétype se recalcule sur le
     nombre de visuels **courant** — retirer le deuxième d'un lot de quatre
     laissait donc la planche « carte » peinte sur l'accent plein cadre du mur,
     avec son anneau devenu invisible dessus. Un fond ne survit pas au rang qui
     l'a choisi ; il n'a donc rien à faire dans `PlannedScreen`. */
  const background = backgroundFor(archetype, plan.palette)

  const layout = composeArchetype(archetype, {
    palette: plan.palette,
    background,
    headline: screen.headline,
    deviceAspect: frame.width / frame.height,
    index,
  })

  const carriesLogo = Boolean(brief.logo) && (index === 0 || archetype === 'mur')
  const logo = carriesLogo ? logoBox(brief, archetype) : null

  /* Le logo se pose en haut, et l'archétype ne sait pas qu'il existe : sur
     l'ouverture, l'accroche commence à 43 et la bande du logo occupe 32 à 80.
     Mesuré, le texte était peint par-dessus le logo sur le seul visuel que la
     plupart des gens verront. Ce qui suit le logo descend donc d'autant — le
     bloc de texte et l'appareil ensemble, pour que l'écart entre eux, lui, ne
     bouge pas. La composition sans logo n'est pas touchée. */
  const crowded = logo && logo.y === LOGO_TOP && layout.headline.y < LOGO_TOP + LOGO_HEIGHT
  const shift = crowded ? LOGO_TOP + LOGO_HEIGHT + LOGO_GAP - layout.headline.y : 0
  const headline = { ...layout.headline, y: layout.headline.y + shift }
  const device = layout.device ? { ...layout.device, y: layout.device.y + shift } : undefined

  return {
    ...layout,
    headline,
    archetype,
    background,
    ...(device
      ? {
          device: {
            ...device,
            ...(shot?.assetId && shot.size
              ? { assetId: shot.assetId, screenshotSize: shot.size }
              : {}),
          },
        }
      : {}),
    ...(carriesLogo && logo && brief.logo
      ? { logo: { ...logo, assetId: brief.logo.assetId, size: brief.logo.size } }
      : {}),
  }
}

/**
 * Traduit le plan en appels d'outils — la seule route vers le projet.
 *
 * Le plan ne pose rien lui-même : il devient la même suite d'appels qu'un
 * modèle aurait dû produire, et passe par le même exécuteur, les mêmes bornes
 * et la même validation. Une seule voie d'écriture veut dire une seule surface
 * à auditer.
 */
export function planToolCalls(plan: CampaignPlan, brief: CampaignBrief): ToolCall[] {
  const calls: ToolCall[] = [
    {
      tool: 'declare_plan',
      args: {
        summary: `${plan.appName} — ${plan.screens.length} visuels, style « ${direction(plan.direction).label} »`,
        screens: plan.screens.map((screen) => ({
          name: screen.name,
          headline: screen.headline,
          ...(screen.slot ? { slot: screen.slot } : {}),
        })),
      },
    },
  ]

  for (const [index, screen] of plan.screens.entries()) {
    const layout = planScreenLayout(plan, brief, index)
    if (!layout) continue

    calls.push({ tool: 'add_screen', args: { name: screen.name } })
    calls.push({ tool: 'set_background', args: { background: layout.background } })

    /* L'ordre est l'ordre de peinture : `applyToolCalls` empile les calques
       dans l'ordre des appels. Fond, formes de profondeur, appareil, pastille
       de lisibilité, logo, puis l'accroche — qui est toujours en dernier,
       parce qu'une accroche recouverte est une planche perdue. */
    for (const accent of layout.accentsBehind) calls.push(accentCall(accent))

    if (layout.device) {
      calls.push({
        tool: 'add_device',
        args: {
          deviceModel: plan.deviceModel,
          x: layout.device.x,
          y: layout.device.y,
          width: layout.device.width,
          height: layout.device.height,
          rotation: layout.device.rotation,
          ...(screen.slot ? { slot: screen.slot } : {}),
          ...(layout.device.assetId && layout.device.screenshotSize
            ? {
                assetId: layout.device.assetId,
                screenshotWidth: layout.device.screenshotSize.width,
                screenshotHeight: layout.device.screenshotSize.height,
              }
            : {}),
        },
      })
    }

    for (const accent of layout.accentsFront) calls.push(accentCall(accent))

    if (layout.logo) {
      calls.push({
        tool: 'add_image',
        args: {
          assetId: layout.logo.assetId,
          originalWidth: layout.logo.size.width,
          originalHeight: layout.logo.size.height,
          name: `Logo ${plan.appName}`.slice(0, 60),
          x: layout.logo.x,
          y: layout.logo.y,
          width: layout.logo.width,
          height: layout.logo.height,
        },
      })
    }

    calls.push({
      tool: 'add_text',
      args: {
        content: layout.headline.text,
        x: layout.headline.x,
        y: layout.headline.y,
        width: layout.headline.width,
        height: layout.headline.height,
        fontSize: layout.headline.fontSize,
        fontWeight: layout.headline.fontWeight,
        color: layout.headline.color,
        textAlign: layout.headline.align,
      },
    })
  }

  return calls
}

function accentCall(accent: PlanAccent): ToolCall {
  return {
    tool: 'add_shape',
    args: {
      shapeType: accent.shape,
      x: accent.x,
      y: accent.y,
      width: accent.width,
      height: accent.height,
      fill: accent.color,
      opacity: accent.opacity,
      rotation: accent.rotation,
    },
  }
}

/**
 * Applique la direction visuelle à un écran déjà composé.
 *
 * C'est la retouche du planificateur local : elle ne crée rien, elle
 * harmonise — le fond, l'encre des textes, la teinte des formes et des icônes.
 * Tous les appels sont bornés à l'écran visé, et l'exécuteur le revérifie.
 */
/**
 * Repeindre un écran déjà posé, et n'émettre que ce qui change vraiment.
 *
 * Le filtrage n'est pas une optimisation, c'est ce qui rend le geste honnête.
 * « Sobre » vaut `#f2f3f5` sur `#141413`, ce qu'un écran produit par ce même
 * générateur en direction Sobre porte déjà exactement : repeindre ouvrait alors
 * une transaction, écrivait un pas d'annulation, annonçait « restylé » et
 * fermait la boîte sans qu'un seul pixel bouge. L'utilisateur en conclut que le
 * bouton est cassé, et il a raison de le conclure — un succès qui ne se voit
 * pas ne se distingue pas d'une panne.
 *
 * Rendre une liste vide est donc un résultat, pas un cas dégénéré : l'appelant
 * y lit « cet écran porte déjà ce style » et le dit, au lieu de fermer.
 *
 * `background` est passé à part parce que c'est la propriété de l'écran et non
 * d'un calque, et parce que la comparaison doit voir un dégradé pour ce qu'il
 * est : un fond dégradé n'est jamais la même chose qu'un aplat, même si l'une
 * de ses bornes tombe sur la bonne couleur.
 *
 * Le fond posé est celui d'un archétype, jamais l'aplat nu de la palette : le
 * geste s'appelle « harmoniser avec la campagne », et une campagne ne pose plus
 * d'aplat. Un écran déjà composé par le générateur en sort donc inchangé, ce que
 * la liste vide dit à l'appelant. Ce que la fonction ne sait pas et n'a aucun
 * moyen de savoir : si une forme sert la composition — la pastille de
 * lisibilité sous une accroche posée sur l'appareil, par exemple — plutôt que
 * l'ornement. Elle les repeint toutes en accent. Sur un écran que l'utilisateur
 * a composé lui-même c'est la promesse ; sur un visuel généré, c'est une
 * pastille qui change de couleur sous son texte.
 */
export function restyleCalls(
  screen: {
    background: Background
    /* `fill` en `unknown` : une forme peut porter un dégradé, et c'est
       précisément un cas où il faut repeindre. La comparaison avec la teinte
       échoue alors, ce qui est la bonne réponse — pas un cas à écarter. */
    layers: readonly { id: string; type: string; locked: boolean; color?: string; fill?: unknown }[]
  },
  palette: Palette,
): ToolCall[] {
  const calls: ToolCall[] = []
  const wanted = backgroundFor('plein-cadre', palette)
  /* Comparés par ce qu'ils peignent, pas par leur forme : deux objets aux mêmes
     couleurs mais aux clés dans un autre ordre sont le même fond, et c'est ce
     que l'utilisateur voit qui décide s'il reste quelque chose à harmoniser. */
  if (backgroundToCss(screen.background) !== backgroundToCss(wanted)) {
    calls.push({ tool: 'set_background', args: { background: wanted } })
  }
  for (const layer of screen.layers) {
    if (layer.locked) continue
    if (layer.type === 'text' && layer.color !== palette.ink) {
      calls.push({
        tool: 'update_layer',
        args: { layerId: layer.id, patch: { color: palette.ink } },
      })
    }
    if (layer.type === 'icon' && layer.color !== palette.accent) {
      calls.push({
        tool: 'update_layer',
        args: { layerId: layer.id, patch: { color: palette.accent } },
      })
    }
    if (layer.type === 'shape' && layer.fill !== palette.accent) {
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
