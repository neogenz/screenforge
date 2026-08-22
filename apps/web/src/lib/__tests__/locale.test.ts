import { beforeEach, describe, expect, it } from 'vitest'
import {
  addLocale,
  applyTranslations,
  fontsForScript,
  isFontCompatible,
  localeBlocked,
  localeFont,
  localizedScreens,
  measuredHeight,
  removeLocale,
  reviewLocale,
  seedTexts,
  setLocaleFont,
  setLocaleText,
  unreviewedCount,
  wrappedLineCount,
  type TextMeasure,
} from '@/lib/locale'
import { isProject, MAX_PROJECT_LOCALES } from '@/lib/project-validation'
import { useHistoryStore } from '@/stores/history.store'
import { DEFAULT_GLOBALS, useProjectStore } from '@/stores/project.store'
import type { LocaleVariant, Project, Screen, TextLayer } from '@/types'

/**
 * Ce qu'une langue doit prouver.
 *
 * Deux choses, et elles sont indépendantes : la variante **ne duplique rien**
 * (mêmes écrans, mêmes identifiants, seule la chaîne change), et un texte qui
 * ne tient plus est **nommé avant l'export**. Le reste — polices par script,
 * bornes, révision — sert ces deux-là.
 *
 * La mesure est injectée : une largeur de glyphe fixe rend le verdict
 * déterministe, là où `measureText` dépend des polices réellement chargées par
 * la machine qui exécute le test.
 */

/** Chaque caractère vaut la moitié de la taille de police. */
const measure: TextMeasure = (text, layer) => text.length * layer.fontSize * 0.5

function textLayer(id: string, content: string, over: Partial<TextLayer> = {}): TextLayer {
  return {
    id,
    type: 'text',
    name: `Texte ${id}`,
    x: 20,
    y: 100,
    width: 200,
    height: 40,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    zIndex: 0,
    content,
    fontFamily: 'Space Grotesk',
    fontSize: 20,
    fontWeight: 700,
    color: '#111111',
    textAlign: 'left',
    lineHeight: 1,
    letterSpacing: 0,
    textTransform: 'none',
    ...over,
  }
}

function screen(id: string, layers: TextLayer[]): Screen {
  return { id, name: `Écran ${id}`, background: { type: 'solid', color: '#ffffff' }, layers }
}

function project(layers: TextLayer[]): Project {
  return {
    id: 'projet',
    name: 'Cadence',
    profileId: 'iphone-6.9',
    screens: [screen('s1', layers)],
    activeScreenId: 's1',
    globals: DEFAULT_GLOBALS,
    layoutLayers: [],
    createdAt: 1,
    updatedAt: 1,
  }
}

function open(value: Project) {
  useProjectStore.setState({ project: value })
  useHistoryStore.getState().clear()
}

function current(): Project {
  const value = useProjectStore.getState().project
  if (!value) throw new Error('aucun projet')
  return value
}

beforeEach(() => {
  open(project([textLayer('t1', 'Le rythme'), textLayer('t2', 'Chaque euro à sa place')]))
})

describe('polices et scripts', () => {
  it('ne propose pour un script que des polices qui le couvrent', () => {
    expect(fontsForScript('japanese')).toContain('Noto Sans JP')
    expect(fontsForScript('japanese')).not.toContain('Space Grotesk')
    expect(isFontCompatible('Space Grotesk', 'latin')).toBe(true)
    expect(isFontCompatible('Space Grotesk', 'japanese')).toBe(false)
    expect(isFontCompatible('Noto Sans Arabic', 'arabic')).toBe(true)
  })

  it('ignore une police imposée que le script ne couvre pas', () => {
    const layer = textLayer('t1', 'Le rythme', { fontFamily: 'Archivo' })
    const locale: LocaleVariant = {
      code: 'ja',
      name: 'Japonais',
      script: 'japanese',
      fontFamily: 'Space Grotesk',
      texts: {},
    }
    // Une police latine imposée à une langue japonaise n'est pas appliquée :
    // le calque garde la sienne plutôt que de rendre des carrés vides.
    expect(localeFont(locale, layer)).toBe('Archivo')
    expect(localeFont({ ...locale, fontFamily: 'Noto Sans JP' }, layer)).toBe('Noto Sans JP')
  })

  it('refuse d’imposer une police hors script, et laisse la retirer', () => {
    addLocale('ja', 'Japonais', 'japanese')
    expect(setLocaleFont('ja', 'Space Grotesk').committed).toBe(false)
    expect(setLocaleFont('ja', 'Noto Sans JP').committed).toBe(true)
    expect(current().locales?.[0].fontFamily).toBe('Noto Sans JP')
    expect(setLocaleFont('ja', undefined).committed).toBe(true)
    expect(current().locales?.[0].fontFamily).toBeUndefined()
  })
})

describe('substitution', () => {
  it('remplace le texte sans toucher aux identifiants ni à la structure', () => {
    addLocale('ja', 'Japonais', 'japanese', 'Noto Sans JP')
    setLocaleText('ja', 't1', 'リズム', true)
    const locale = current().locales![0]

    const screens = localizedScreens(current(), locale)
    expect(screens).toHaveLength(current().screens.length)
    expect(screens[0].id).toBe('s1')
    expect(screens[0].layers.map((layer) => layer.id)).toEqual(['t1', 't2'])
    expect((screens[0].layers[0] as TextLayer).content).toBe('リズム')
    expect((screens[0].layers[0] as TextLayer).fontFamily).toBe('Noto Sans JP')
    // La géométrie appartient au projet, pas à la langue.
    expect(screens[0].layers[0].x).toBe(current().screens[0].layers[0].x)
  })

  it('laisse intact un calque que la langue ne nomme pas', () => {
    const locale: LocaleVariant = { code: 'de', name: 'Allemand', script: 'latin', texts: {} }
    const screens = localizedScreens(current(), locale)
    expect(screens[0].layers).toEqual(current().screens[0].layers)
  })

  it('part du projet, non relu, plutôt que du vide', () => {
    const texts = seedTexts(current())
    expect(Object.keys(texts)).toEqual(['t1', 't2'])
    expect(texts.t1).toEqual({ value: 'Le rythme', reviewed: false })
  })
})

describe('mesure et débordements', () => {
  it('compte les lignes qu’un texte occupe dans la largeur du calque', () => {
    const layer = textLayer('t1', '')
    // 200 px de large, 10 px par caractère : dix caractères par ligne.
    expect(wrappedLineCount('abcdefghij', layer, 'x', measure)).toBe(1)
    expect(wrappedLineCount('abcdefghij klmnopqrst', layer, 'x', measure)).toBe(2)
    expect(wrappedLineCount('ligne\nligne', layer, 'x', measure)).toBe(2)
    // Un mot sans espace plus large que la boîte est coupé, pas laissé
    // déborder — c'est aussi ce qui couvre les écritures sans espaces.
    expect(wrappedLineCount('a'.repeat(35), layer, 'x', measure)).toBe(2)
    expect(wrappedLineCount('a'.repeat(45), layer, 'x', measure)).toBe(3)
  })

  it('mesure la casse rendue, pas celle saisie', () => {
    const upper = textLayer('t1', 'abcdefghij', { textTransform: 'uppercase' })
    expect(measuredHeight(upper, 'x', measure)).toBe(20)
  })

  it('signale un texte traduit qui ne tient plus dans sa boîte', () => {
    addLocale('de', 'Allemand', 'latin')
    setLocaleText('de', 't1', 'Ein sehr langer deutscher Satz der nicht mehr hineinpasst', false)
    const findings = reviewLocale(current(), current().locales![0], measure)
    expect(findings.map((finding) => finding.kind)).toContain('overflow')
    expect(findings.find((finding) => finding.kind === 'overflow')?.layerId).toBe('t1')
    expect(localeBlocked(findings)).toBe(true)
  })

  it('ne signale rien quand la traduction tient', () => {
    addLocale('de', 'Allemand', 'latin')
    setLocaleText('de', 't1', 'Kurz', true)
    setLocaleText('de', 't2', 'Auch kurz', true)
    expect(reviewLocale(current(), current().locales![0], measure)).toEqual([])
  })

  it('signale un texte vide, et ne mesure pas ce qui n’existe pas', () => {
    addLocale('de', 'Allemand', 'latin')
    setLocaleText('de', 't1', '   ', false)
    const findings = reviewLocale(current(), current().locales![0], measure)
    expect(findings.filter((finding) => finding.layerId === 't1')).toHaveLength(1)
    expect(findings[0].kind).toBe('empty')
  })

  it('signale un calque partagé qui déborde, comme celui d’un écran', () => {
    // Un texte « partagé partout » se rend sur les dix planches. Il était semé
    // dans la variante, listé dans la boîte et substitué à l'export, mais la
    // revue ne descendait que dans les écrans : il débordait partout et rien ne
    // bloquait ni l'export ni le figement.
    open({
      ...project([]),
      layoutLayers: [textLayer('partout', 'Le rythme', { scope: 'layout' })],
    })
    addLocale('de', 'Allemand', 'latin')
    setLocaleText(
      'de',
      'partout',
      'Ein sehr langer deutscher Satz der nicht mehr hineinpasst',
      false,
    )
    const findings = reviewLocale(current(), current().locales![0], measure)
    expect(findings.map((finding) => finding.kind)).toContain('overflow')
    expect(findings.find((finding) => finding.kind === 'overflow')?.layerId).toBe('partout')
    expect(localeBlocked(findings)).toBe(true)
  })

  it('signale un bloc sorti du cadre de l’écran', () => {
    open(project([textLayer('t1', 'Le rythme', { y: 940, height: 40 })]))
    addLocale('de', 'Allemand', 'latin')
    setLocaleText('de', 't1', 'Kurz', true)
    const findings = reviewLocale(current(), current().locales![0], measure)
    expect(findings.map((finding) => finding.kind)).toContain('off-canvas')
  })
})

describe('écriture', () => {
  it('crée une langue, la retrouve, et refuse un doublon', () => {
    expect(addLocale('ja', 'Japonais', 'japanese').committed).toBe(true)
    expect(addLocale('ja', 'Japonais', 'japanese').committed).toBe(false)
    expect(current().locales).toHaveLength(1)
    expect(isProject(current())).toBe(true)
  })

  it('refuse un code hors norme, et plafonne le nombre de langues', () => {
    expect(addLocale('JAPONAIS', 'Japonais', 'japanese').committed).toBe(false)
    expect(addLocale('j', 'Japonais', 'japanese').committed).toBe(false)
    expect(addLocale('pt-BR', 'Portugais (Brésil)', 'latin').committed).toBe(true)

    const codes = ['de', 'es', 'it', 'nl', 'pl', 'sv', 'da', 'fi', 'cs', 'hu', 'ro', 'sk']
    for (const code of codes) addLocale(code, code, 'latin')
    expect(current().locales!.length).toBe(MAX_PROJECT_LOCALES)
  })

  it('supprime une langue sans toucher au reste du projet', () => {
    addLocale('ja', 'Japonais', 'japanese')
    const screens = current().screens
    expect(removeLocale('ja').committed).toBe(true)
    expect(removeLocale('ja').committed).toBe(false)
    expect(current().locales).toEqual([])
    expect(current().screens).toEqual(screens)
  })

  it('groupe une rafale de frappes en un seul pas d’annulation', () => {
    addLocale('de', 'Allemand', 'latin')
    const depth = useHistoryStore.getState().past.length
    for (const value of ['K', 'Ku', 'Kur', 'Kurz']) setLocaleText('de', 't1', value, false)
    expect(useHistoryStore.getState().past.length).toBe(depth + 1)
    expect(current().locales![0].texts.t1.value).toBe('Kurz')
  })

  it('reprend les traductions non relues, et ignore les calques inconnus', () => {
    addLocale('de', 'Allemand', 'latin')
    setLocaleText('de', 't1', 'Kurz', true)
    const outcome = applyTranslations('de', { t1: 'Rhythmus', t2: 'Jeder Euro', inconnu: 'x' })
    expect(outcome.committed && outcome.value).toBe(2)
    const locale = current().locales![0]
    expect(locale.texts.t1).toEqual({ value: 'Rhythmus', reviewed: false })
    expect(locale.texts.inconnu).toBeUndefined()
    expect(unreviewedCount(locale)).toBe(2)
  })

  it('refuse un lot dont aucun texte ne correspond', () => {
    addLocale('de', 'Allemand', 'latin')
    const before = current()
    expect(applyTranslations('de', { inconnu: 'x' }).committed).toBe(false)
    expect(useProjectStore.getState().project).toBe(before)
  })
})
