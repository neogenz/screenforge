import { SCREEN_HEIGHT, SCREEN_WIDTH, transformText } from '@/lib/canvas/canvas-utils'
import { ABORT, runEditorTransaction } from '@/lib/editor-transaction'
import { POPULAR_FONTS } from '@/lib/fonts'
import {
  LOCALE_CODE,
  MAX_LOCALE_NAME_LENGTH,
  MAX_LOCALE_TEXT_LENGTH,
  MAX_PROJECT_LOCALES,
} from '@/lib/project-validation'
import type {
  Layer,
  LocaleText,
  LocaleVariant,
  Project,
  ProjectSnapshot,
  ScriptId,
  Screen,
  TextLayer,
} from '@/types'

/**
 * Une langue de plus, sans un projet de plus.
 *
 * La variante ne porte que des textes, indexés par l'identifiant du calque
 * qu'ils remplacent. Rien n'est dupliqué : ni écran, ni calque, ni cadrage, ni
 * rôle. C'est ce qui rend la reprise possible — corriger une mise en page la
 * corrige dans les dix langues, et une langue ne peut pas dériver de la
 * structure sans que quelqu'un l'ait décidé.
 *
 * Ce fichier ne promet aucune traduction juste. Il rend une variante
 * **relisible** : chaque texte porte son état de révision, chaque débordement
 * est nommé, et une langue qui déborde ne s'exporte pas.
 */

/**
 * Les scripts, et les polices qui les couvrent réellement.
 *
 * Une liste fermée par script, pas un filtre sur le catalogue latin : « Space
 * Grotesk » ne dessine aucun kana, et l'y proposer produirait une planche de
 * carrés vides que rien dans l'éditeur ne signalerait. Les familles listées
 * sont des familles Google Fonts, chargées à la demande par `lib/fonts.ts`
 * comme n'importe quelle autre.
 */
export const SCRIPTS: readonly { id: ScriptId; label: string; fonts: readonly string[] }[] = [
  { id: 'latin', label: 'Latin', fonts: POPULAR_FONTS },
  {
    id: 'cyrillic',
    label: 'Cyrillique',
    fonts: ['Roboto', 'Open Sans', 'Montserrat', 'Noto Sans', 'PT Sans', 'Rubik', 'Fira Sans'],
  },
  { id: 'greek', label: 'Grec', fonts: ['Roboto', 'Open Sans', 'Noto Sans', 'Fira Sans'] },
  {
    id: 'japanese',
    label: 'Japonais',
    fonts: ['Noto Sans JP', 'Noto Serif JP', 'M PLUS 1p', 'Zen Kaku Gothic New'],
  },
  { id: 'korean', label: 'Coréen', fonts: ['Noto Sans KR', 'Noto Serif KR', 'Nanum Gothic'] },
  {
    id: 'simplified-chinese',
    label: 'Chinois simplifié',
    fonts: ['Noto Sans SC', 'Noto Serif SC'],
  },
  {
    id: 'arabic',
    label: 'Arabe',
    fonts: ['Noto Sans Arabic', 'Noto Kufi Arabic', 'Cairo', 'Tajawal'],
  },
  { id: 'hebrew', label: 'Hébreu', fonts: ['Noto Sans Hebrew', 'Rubik', 'Heebo', 'Assistant'] },
  {
    id: 'devanagari',
    label: 'Devanagari',
    fonts: ['Noto Sans Devanagari', 'Poppins', 'Mukta', 'Hind'],
  },
  { id: 'thai', label: 'Thaï', fonts: ['Noto Sans Thai', 'Sarabun', 'Prompt', 'Kanit'] },
]

export function script(id: ScriptId): (typeof SCRIPTS)[number] {
  return SCRIPTS.find((entry) => entry.id === id) ?? SCRIPTS[0]
}

export function fontsForScript(id: ScriptId): readonly string[] {
  return script(id).fonts
}

export function isFontCompatible(family: string, id: ScriptId): boolean {
  return fontsForScript(id).includes(family)
}

/** La police effective d'une langue : celle imposée, sinon celle du calque. */
export function localeFont(locale: LocaleVariant, layer: TextLayer): string {
  return locale.fontFamily && isFontCompatible(locale.fontFamily, locale.script)
    ? locale.fontFamily
    : layer.fontFamily
}

// ─── Substitution ────────────────────────────────────────────────────────────

function isText(layer: Layer): layer is TextLayer {
  return layer.type === 'text'
}

function localized(layer: TextLayer, locale: LocaleVariant): TextLayer {
  const variant = locale.texts[layer.id]
  if (!variant) return layer
  return { ...layer, content: variant.value, fontFamily: localeFont(locale, layer) }
}

function localizedLayers(layers: Layer[], locale: LocaleVariant): Layer[] {
  return layers.map((layer) => (isText(layer) ? localized(layer, locale) : layer))
}

/**
 * Le projet dans une langue : les mêmes écrans, les mêmes identifiants.
 *
 * Rendu à la demande, jamais rangé : une copie persistée serait une seconde
 * source de vérité pour la géométrie, et elle aurait divergé au premier
 * déplacement de calque.
 */
export function localizedScreens(
  project: Project | ProjectSnapshot,
  locale: LocaleVariant,
): Screen[] {
  return project.screens.map((screen) => ({
    ...screen,
    layers: localizedLayers(screen.layers, locale),
  }))
}

export function localizedLayoutLayers(
  project: Project | ProjectSnapshot,
  locale: LocaleVariant,
): Layer[] {
  return localizedLayers(project.layoutLayers, locale)
}

// ─── Mesure et débordements ──────────────────────────────────────────────────

/** Largeur d'une chaîne pour une police donnée, en pixels de scène. */
export type TextMeasure = (text: string, layer: TextLayer, family: string) => number

let sharedContext: CanvasRenderingContext2D | null | undefined

/**
 * La mesure réelle du navigateur.
 *
 * `measureText` sur un contexte 2d hors écran, avec la même police, la même
 * graisse et la même taille que le rendu.
 *
 * ponytail: la police doit être chargée pour que la mesure soit juste — sinon
 * le navigateur substitue et la largeur est celle du repli. La revue charge
 * donc la police de la langue avant de mesurer ; à défaut, le verdict penche du
 * côté prudent, un repli latin étant plus étroit qu'un idéogramme.
 */
export const measureWithCanvas: TextMeasure = (text, layer, family) => {
  if (sharedContext === undefined) {
    sharedContext = document.createElement('canvas').getContext('2d')
  }
  if (!sharedContext) return text.length * layer.fontSize * 0.5
  sharedContext.font = `${layer.fontWeight} ${layer.fontSize}px "${family}"`
  return sharedContext.measureText(text).width + layer.letterSpacing * text.length
}

/**
 * Le nombre de lignes qu'un texte occupe dans la largeur du calque.
 *
 * ponytail: la coupure suit les espaces, et un mot plus large que la boîte est
 * coupé caractère par caractère — ce qui couvre aussi les écritures sans
 * espaces (japonais, chinois, thaï), où chaque glyphe devient un point de
 * coupure. Fabric applique des règles plus fines (césure, joncteurs) : la
 * mesure peut donc annoncer une ligne de trop sur un cas limite, jamais une de
 * moins, ce qui est le bon sens de l'erreur pour une alerte.
 */
export function wrappedLineCount(
  text: string,
  layer: TextLayer,
  family: string,
  measure: TextMeasure,
): number {
  const width = Math.max(1, layer.width)
  let lines = 0
  for (const paragraph of text.split('\n')) {
    let current = ''
    lines += 1
    for (const word of paragraph.split(' ')) {
      const candidate = current ? `${current} ${word}` : word
      if (measure(candidate, layer, family) <= width) {
        current = candidate
        continue
      }
      // Le mot n'entre pas à la suite : il ouvre une ligne, sauf si la ligne
      // courante est déjà vide — auquel cas c'est lui qui est trop large.
      if (current) lines += 1
      current = word
      while (measure(current, layer, family) > width && current.length > 1) {
        let cut = current.length - 1
        while (cut > 1 && measure(current.slice(0, cut), layer, family) > width) cut -= 1
        lines += 1
        current = current.slice(cut)
      }
    }
  }
  return Math.max(1, lines)
}

export function measuredHeight(layer: TextLayer, family: string, measure: TextMeasure): number {
  return (
    wrappedLineCount(transformText(layer), layer, family, measure) *
    layer.fontSize *
    layer.lineHeight
  )
}

export type FindingKind =
  /** Le texte de la langue est vide : la planche sortirait sans son accroche. */
  | 'empty'
  /** Le texte traduit ne tient plus dans la boîte dessinée pour lui. */
  | 'overflow'
  /** La boîte, une fois grandie, sort de l'écran. */
  | 'off-canvas'

export interface LocaleFinding {
  screenId: string
  screenName: string
  layerId: string
  layerName: string
  kind: FindingKind
  /** Une phrase, affichable telle quelle. */
  detail: string
}

/**
 * Ce qui empêche cette langue de sortir.
 *
 * Trois défauts, tous mesurés sur le texte de la langue et sur la boîte du
 * projet : vide, plus haut que sa boîte, hors de l'écran. Le troisième existe
 * séparément parce qu'un texte peut tenir dans sa boîte et que la boîte, elle,
 * ait été posée à cheval sur le bord — auquel cas le débordement est déjà vrai
 * dans la langue d'origine, et le dire à la première traduction serait accuser
 * la traduction.
 */
export function reviewLocale(
  project: Project | ProjectSnapshot,
  locale: LocaleVariant,
  measure: TextMeasure = measureWithCanvas,
): LocaleFinding[] {
  const findings: LocaleFinding[] = []
  /* Les calques partagés en font partie. Ils sont semés dans la variante, tenus
     dans la boîte, substitués à l'export — et la revue ne descendait que dans
     les écrans, donc un titre partagé pouvait déborder sur les dix planches
     sans que rien ne le voie, ni ne bloque l'export, ni ne retienne le
     figement. Ils n'appartiennent à aucun écran : même désignation que
     `refreshTargets`, pour que les deux listes se lisent pareil. */
  const zones = [
    ...project.screens.map((screen) => ({
      id: screen.id,
      name: screen.name,
      layers: screen.layers as readonly Layer[],
    })),
    { id: '', name: 'Tous les écrans', layers: project.layoutLayers as readonly Layer[] },
  ]

  for (const screen of zones) {
    for (const layer of screen.layers) {
      if (!isText(layer)) continue
      const variant = locale.texts[layer.id]
      if (!variant) continue
      const at = {
        screenId: screen.id,
        screenName: screen.name,
        layerId: layer.id,
        layerName: layer.name,
      }

      if (!variant.value.trim()) {
        findings.push({ ...at, kind: 'empty', detail: 'Texte vide dans cette langue.' })
        continue
      }

      const family = localeFont(locale, layer)
      const height = measuredHeight({ ...layer, content: variant.value }, family, measure)
      if (height > layer.height + 0.5) {
        findings.push({
          ...at,
          kind: 'overflow',
          detail: `${Math.round(height)} px de texte dans une boîte de ${Math.round(layer.height)} px.`,
        })
      }
      const bottom = layer.y + Math.max(layer.height, height)
      if (
        layer.x < 0 ||
        layer.y < 0 ||
        layer.x + layer.width > SCREEN_WIDTH ||
        bottom > SCREEN_HEIGHT
      ) {
        findings.push({ ...at, kind: 'off-canvas', detail: 'Le bloc sort du cadre de l’écran.' })
      }
    }
  }
  return findings
}

/** Une langue avec le moindre défaut ne s'exporte pas. */
export function localeBlocked(findings: readonly LocaleFinding[]): boolean {
  return findings.length > 0
}

export function unreviewedCount(locale: LocaleVariant): number {
  return Object.values(locale.texts).filter((text) => !text.reviewed).length
}

// ─── Création et écriture ────────────────────────────────────────────────────

export function textLayersOf(project: Project | ProjectSnapshot): TextLayer[] {
  return [...project.screens.flatMap((screen) => screen.layers), ...project.layoutLayers].filter(
    isText,
  )
}

/**
 * Une langue neuve part du projet, pas du vide.
 *
 * Chaque texte est copié tel quel et marqué non relu : l'utilisateur voit
 * immédiatement une planche entière dans la nouvelle langue, avec exactement ce
 * qui reste à traduire. Partir d'entrées vides aurait produit dix débordements
 * « texte vide » à la seconde de la création, ce qui n'apprend rien.
 */
export function seedTexts(project: Project | ProjectSnapshot): Record<string, LocaleText> {
  return Object.fromEntries(
    textLayersOf(project).map((layer) => [layer.id, { value: layer.content, reviewed: false }]),
  )
}

export function findLocale(project: Project, code: string): LocaleVariant | undefined {
  return project.locales?.find((locale) => locale.code === code)
}

export function addLocale(code: string, name: string, scriptId: ScriptId, fontFamily?: string) {
  return runEditorTransaction((draft) => {
    const locales = draft.locales ?? []
    if (locales.length >= MAX_PROJECT_LOCALES) return ABORT
    if (!LOCALE_CODE.test(code) || locales.some((locale) => locale.code === code)) return ABORT
    draft.locales = [
      ...locales,
      {
        code,
        name: name.trim().slice(0, MAX_LOCALE_NAME_LENGTH) || code,
        script: scriptId,
        ...(fontFamily && isFontCompatible(fontFamily, scriptId) ? { fontFamily } : {}),
        texts: seedTexts(draft),
      },
    ]
    return code
  })
}

export function removeLocale(code: string) {
  return runEditorTransaction((draft) => {
    const locales = draft.locales ?? []
    if (!locales.some((locale) => locale.code === code)) return ABORT
    draft.locales = locales.filter((locale) => locale.code !== code)
    return code
  })
}

/** Une écriture ciblée : un texte, dans une langue, avec son état de révision. */
export function setLocaleText(code: string, layerId: string, value: string, reviewed: boolean) {
  return runEditorTransaction((draft) => {
    const locale = draft.locales?.find((entry) => entry.code === code)
    if (!locale) return ABORT
    locale.texts[layerId] = { value: value.slice(0, MAX_LOCALE_TEXT_LENGTH), reviewed }
    return layerId
  }, `locale:${code}:${layerId}`)
}

export function setLocaleFont(code: string, fontFamily: string | undefined) {
  return runEditorTransaction((draft) => {
    const locale = draft.locales?.find((entry) => entry.code === code)
    if (!locale) return ABORT
    if (fontFamily && !isFontCompatible(fontFamily, locale.script)) return ABORT
    if (fontFamily) locale.fontFamily = fontFamily
    else delete locale.fontFamily
    return code
  })
}

/**
 * Reprend les textes proposés par un traducteur.
 *
 * Tout le lot en une transaction, et tout arrive **non relu** : une proposition
 * automatique est une proposition, et l'écran de revue existe pour cela. Les
 * calques inconnus sont ignorés plutôt que créés — un traducteur ne décide pas
 * de la structure.
 */
export function applyTranslations(code: string, proposals: Record<string, string>) {
  return runEditorTransaction((draft) => {
    const locale = draft.locales?.find((entry) => entry.code === code)
    if (!locale) return ABORT
    let applied = 0
    for (const [layerId, value] of Object.entries(proposals)) {
      if (!(layerId in locale.texts)) continue
      locale.texts[layerId] = { value: value.slice(0, MAX_LOCALE_TEXT_LENGTH), reviewed: false }
      applied += 1
    }
    if (applied === 0) return ABORT
    return applied
  })
}
