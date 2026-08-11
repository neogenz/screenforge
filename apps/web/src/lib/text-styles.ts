/**
 * La couleur d'un passage, et non plus celle du calque entier.
 *
 * Un calque texte porte une couleur, et c'est presque toujours ce qu'on veut :
 * une accroche se lit d'un bloc. Presque. Le mot qu'on met en avant dans la
 * phrase n'avait aucun moyen d'exister — il fallait couper le calque en trois
 * et réaligner les morceaux à la main, ce qui casse à la première retouche du
 * texte.
 *
 * Fabric tient déjà des styles par caractère, indexés ligne puis colonne, et un
 * `Textbox` les indexe sur les lignes **non repliées** : celles que sépare un
 * `\n` dans le contenu, jamais celles que le repli fabrique. C'est toute la
 * raison pour laquelle ce module fait ses comptes sans jamais toucher au
 * canevas — la largeur de la boîte n'entre pas dans l'index, donc redimensionner
 * un calque ne déplace pas une seule couleur.
 *
 * Fabric maintient aussi ces index pendant la frappe : insérer un mot au milieu
 * d'un passage coloré décale les styles avec lui. C'est pour ça que la sortie
 * d'édition les relit depuis l'objet plutôt que de les recalculer.
 */
import type { TextCharStyle, TextCharStyles, TextLayer } from '@/types'

/** Le passage en cours de sélection dans un calque texte, sur le canevas. */
export interface TextRange {
  layerId: string
  /** Index plats dans le contenu, `\n` compris, comme Fabric les compte. */
  start: number
  end: number
}

/**
 * Clés remises en ordre numérique.
 *
 * Deux styles identiques doivent produire la même chaîne : c'est ce qui permet
 * à la sortie d'édition de ne rien écrire quand rien n'a bougé, et donc de ne
 * pas déposer un pas d'annulation à chaque clic hors d'un texte.
 */
function sorted(styles: TextCharStyles): TextCharStyles {
  const out: TextCharStyles = {}
  for (const line of Object.keys(styles)
    .map(Number)
    .sort((a, b) => a - b)) {
    const columns = styles[line]
    const inner: Record<string, TextCharStyle> = {}
    for (const column of Object.keys(columns)
      .map(Number)
      .sort((a, b) => a - b)) {
      inner[column] = columns[column]
    }
    if (Object.keys(inner).length > 0) out[line] = inner
  }
  return out
}

function isEmpty(styles: TextCharStyles): boolean {
  return Object.keys(styles).length === 0
}

/**
 * Peint — ou dépeint, avec `fill: null` — les caractères de `[start, end)`.
 *
 * Le parcours se fait en points de code et non en unités UTF-16 : Fabric compte
 * ses positions en graphèmes, et un emoji vaut une position pour lui.
 */
export function setRangeFill(
  text: string,
  styles: TextCharStyles | undefined,
  start: number,
  end: number,
  fill: string | null,
): TextCharStyles | undefined {
  const next: TextCharStyles = {}
  for (const [line, columns] of Object.entries(styles ?? {})) next[line] = { ...columns }

  let line = 0
  let column = 0
  const characters = Array.from(text)
  for (let index = 0; index < characters.length; index += 1) {
    // Le saut de ligne ouvre la ligne suivante sans occuper de colonne : Fabric
    // ne le range dans aucune, alors que la position plate le compte.
    if (characters[index] === '\n') {
      line += 1
      column = 0
      continue
    }
    if (index >= start && index < end) {
      if (fill) (next[line] ??= {})[column] = { fill }
      else delete next[line]?.[column]
    }
    column += 1
  }

  const pruned = sorted(next)
  return isEmpty(pruned) ? undefined : pruned
}

/** La couleur que tout le passage partage, ou `null` s'il en porte plusieurs. */
export function rangeFill(
  text: string,
  styles: TextCharStyles | undefined,
  start: number,
  end: number,
): string | null {
  if (!styles || start >= end) return null

  let line = 0
  let column = 0
  let common: string | null = null
  const characters = Array.from(text)
  for (let index = 0; index < characters.length; index += 1) {
    if (characters[index] === '\n') {
      line += 1
      column = 0
      continue
    }
    if (index >= start && index < end) {
      const fill = styles[line]?.[column]?.fill ?? null
      if (fill === null) return null
      if (common === null) common = fill
      else if (common !== fill) return null
    }
    column += 1
  }
  return common
}

/**
 * Ne retient de l'objet Fabric que ce que le projet sait relire.
 *
 * Fabric range là tout ce qu'un style de caractère peut porter (graisse, fonte,
 * soulignement…). Le projet n'en promet qu'un, et laisser passer le reste
 * ferait entrer dans le fichier des champs que la validation refuse et que
 * personne ne sait rendre.
 */
export function readCharStyles(styles: unknown): TextCharStyles | undefined {
  if (!styles || typeof styles !== 'object') return undefined
  const out: TextCharStyles = {}
  for (const [line, columns] of Object.entries(styles as Record<string, unknown>)) {
    if (!columns || typeof columns !== 'object') continue
    for (const [column, style] of Object.entries(columns as Record<string, unknown>)) {
      const fill = (style as { fill?: unknown } | null)?.fill
      if (typeof fill !== 'string' || !fill) continue
      ;(out[line] ??= {})[column] = { fill }
    }
  }
  const pruned = sorted(out)
  return isEmpty(pruned) ? undefined : pruned
}

/** Deux jeux de styles disent-ils la même chose ? */
export function sameCharStyles(
  a: TextCharStyles | undefined,
  b: TextCharStyles | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

export function isTextCharStyles(value: unknown): value is TextCharStyles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  for (const [line, columns] of Object.entries(value as Record<string, unknown>)) {
    if (!Number.isInteger(Number(line)) || Number(line) < 0) return false
    if (!columns || typeof columns !== 'object' || Array.isArray(columns)) return false
    for (const [column, style] of Object.entries(columns as Record<string, unknown>)) {
      if (!Number.isInteger(Number(column)) || Number(column) < 0) return false
      const fill = (style as { fill?: unknown } | null)?.fill
      if (typeof fill !== 'string' || !fill) return false
    }
  }
  return true
}

/**
 * La couleur qu'affiche le contrôle, selon qu'un passage est sélectionné.
 *
 * Un passage panaché retombe sur la couleur du calque plutôt que sur celle de
 * son premier caractère : le contrôle dirait sinon d'une sélection de trois
 * couleurs qu'elle en a une.
 */
export function textColorValue(layer: TextLayer, range: TextRange | null): string {
  if (!range || range.layerId !== layer.id) return layer.color
  return rangeFill(layer.content, layer.charStyles, range.start, range.end) ?? layer.color
}

/**
 * Ce que « changer la couleur » veut dire ici, écrit une fois pour les deux
 * surfaces qui le proposent (le panneau Propriétés et la barre de sélection).
 *
 * Repeindre un passage avec la couleur du calque l'efface au lieu de le figer :
 * c'est ce qui rend le geste réversible sans inventer un bouton « rendre au
 * calque », et ça évite qu'un passage devenu invisible cesse de suivre le
 * calque quand on recolore celui-ci.
 */
export function textColorEdit(
  layer: TextLayer,
  range: TextRange | null,
  color: string,
): { updates: Partial<TextLayer>; coalesceKey: string } {
  if (!range || range.layerId !== layer.id) {
    return { updates: { color }, coalesceKey: `layer:${layer.id}:color` }
  }
  const charStyles = setRangeFill(
    layer.content,
    layer.charStyles,
    range.start,
    range.end,
    color === layer.color ? null : color,
  )
  return {
    updates: { charStyles },
    // Le passage entre dans la clé : deux mots recolorés coup sur coup sont
    // deux gestes, et un seul pas d'annulation pour les deux serait un piège.
    coalesceKey: `layer:${layer.id}:charStyles:${range.start}-${range.end}`,
  }
}
