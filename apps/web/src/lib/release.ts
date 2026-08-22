import { EXPORT_DIMENSIONS } from '@/lib/dimensions'
import { ABORT, runEditorTransaction, type TransactionOutcome } from '@/lib/editor-transaction'
import { exportScreenToBlob, inspectPng } from '@/lib/export'
import { sha256OfBlob } from '@/lib/hash'
import { MAX_PROJECT_RELEASES, MAX_RELEASE_NAME_LENGTH } from '@/lib/project-validation'
import { slugify } from '@/lib/zip'
import type {
  DisplayClass,
  GlobalSettings,
  Layer,
  Project,
  ProjectSnapshot,
  Release,
  ReleaseFile,
  Screen,
} from '@/types'

/**
 * Le lot livré, et ce qui a changé depuis.
 *
 * Une campagne se juge entre deux releases : ce qui a bougé, ce qui n'aurait
 * pas dû, ce qui doit repartir chez Apple. Trois choses le rendent possible.
 *
 * **Le figement.** Toutes les planches sont rendues, chacune est hachée, et
 * l'instantané qui les a produites est cloné à côté. La release ne contient
 * aucun pixel : le rendu est déterministe à partir de l'instantané, donc les
 * empreintes suffisent. Dix PNG par release auraient pesé des dizaines de
 * mégaoctets dans IndexedDB pour redire ce que le projet dit déjà.
 *
 * **La vérification.** Rejouer l'instantané et recomparer les empreintes. Si
 * elles diffèrent, quelque chose hors du projet a changé — une police, un
 * cadre, le moteur — et c'est précisément ce qu'un lot prêt à publier doit
 * savoir avant de partir.
 *
 * **Le diff structurel.** Déterministe, ordonné, lisible : l'ordre des écrans
 * du projet actuel d'abord, les disparus ensuite dans leur ordre d'origine.
 * Un ensemble parcouru au hasard rendrait deux fois le même diff dans deux
 * ordres, et personne ne peut relire ça.
 */

/**
 * Ce que le rendu lit du projet, et rien d'autre.
 *
 * L'aperçu d'un écran est laissé dehors : c'est un cache de rendu qui change à
 * chaque coup de pinceau, pèse quelques kilooctets de base64 par écran, et
 * n'entre dans aucune planche. Gardé, il aurait fait diverger deux figements du
 * même contenu et rempli le diff structurel de bruit.
 */
export function snapshotOf(project: Project | ProjectSnapshot): ProjectSnapshot {
  const snapshot = structuredClone({
    name: project.name,
    profileId: project.profileId,
    screens: project.screens,
    layoutLayers: project.layoutLayers,
    globals: project.globals,
  })
  for (const screen of snapshot.screens) delete screen.thumbnail
  return snapshot
}

function releasePath(dimension: DisplayClass, index: number, screen: Screen): string {
  return `${dimension.size.replace('"', '')}/${String(index + 1).padStart(2, '0')}_${slugify(screen.name)}.png`
}

export interface RenderProgress {
  current: number
  total: number
  label: string
}

/**
 * Rend tout le lot et le hache, dans l'ordre.
 *
 * Séquentiel, au contraire de l'export : le rendu d'une planche alloue des
 * dizaines de mégaoctets sur le fil principal, et un figement n'a pas la même
 * urgence qu'un téléchargement que l'utilisateur attend. L'ordre du tableau
 * rendu est celui du manifeste, donc deux figements identiques donnent deux
 * manifestes identiques.
 */
export async function renderReleaseFiles(
  snapshot: ProjectSnapshot,
  onProgress?: (progress: RenderProgress) => void,
  dimensions: DisplayClass[] = EXPORT_DIMENSIONS,
  /**
   * Les octets, pour qui en a besoin.
   *
   * Le figement et la vérification n'en veulent pas — une release ne contient
   * aucun pixel. La publication, si : elle envoie au pont exactement les
   * planches dont elle vient de recalculer l'empreinte, ce qui est la seule
   * façon d'affirmer que ce qui part est bien le lot figé.
   */
  onFile?: (file: ReleaseFile, blob: Blob) => void,
): Promise<ReleaseFile[]> {
  const jobs = dimensions.flatMap((dimension) =>
    snapshot.screens.map((screen, index) => ({ dimension, screen, index })),
  )
  const files: ReleaseFile[] = []

  for (const [position, { dimension, screen, index }] of jobs.entries()) {
    onProgress?.({ current: position, total: jobs.length, label: screen.name })
    const blob = await exportScreenToBlob(
      screen,
      snapshot.layoutLayers,
      dimension.portrait.width,
      dimension.portrait.height,
      index,
    )
    const metadata = await inspectPng(blob)
    const file: ReleaseFile = {
      path: releasePath(dimension, index, screen),
      screenId: screen.id,
      width: metadata.width,
      height: metadata.height,
      byteLength: metadata.byteLength,
      sha256: await sha256OfBlob(blob),
    }
    files.push(file)
    onFile?.(file, blob)
  }

  onProgress?.({ current: jobs.length, total: jobs.length, label: 'Empreintes calculées' })
  return files
}

export function freezeRelease(
  id: string,
  name: string,
  snapshot: ProjectSnapshot,
  files: ReleaseFile[],
  createdAt: number,
  /** La langue rendue, quand ce n'est pas celle d'origine. */
  locale?: string,
): Release {
  return {
    id,
    name: name.trim().slice(0, MAX_RELEASE_NAME_LENGTH),
    createdAt,
    watermarked: false,
    ...(locale ? { locale } : {}),
    files,
    // Cloné une seconde fois : l'appelant garde le sien, la release garde le
    // sien, et aucune écriture ultérieure ne peut traverser de l'un à l'autre.
    snapshot: structuredClone(snapshot),
  }
}

/**
 * Ajoute une release au projet, en une écriture.
 *
 * Elle passe par la transaction comme n'importe quelle autre mutation : le lot
 * figé est un fait du projet, il s'annule et se synchronise avec lui.
 */
export function addRelease(release: Release): TransactionOutcome<number> {
  return runEditorTransaction((draft) => {
    const releases = [...(draft.releases ?? []), release]
    if (releases.length > MAX_PROJECT_RELEASES) return ABORT
    draft.releases = releases
    return releases.length
  })
}

/**
 * Retire une release.
 *
 * Immuable ne veut pas dire indestructible : ce qui est interdit est de
 * réécrire un lot livré, pas d'oublier un lot dont on n'a plus l'usage. Les
 * assets que seul cet instantané retenait redeviennent balayables au prochain
 * chargement, là où la pile d'annulation vient d'être vidée.
 */
export function removeRelease(id: string): TransactionOutcome<number> {
  return runEditorTransaction((draft) => {
    const releases = (draft.releases ?? []).filter((release) => release.id !== id)
    if (releases.length === (draft.releases ?? []).length) return ABORT
    draft.releases = releases
    return releases.length
  })
}

/**
 * Ramène le projet dans l'état d'une release, sans y toucher.
 *
 * C'est la moitié qui manquait au cycle, et son absence rendait le reste
 * incompréhensible : on figeait un lot sans jamais pouvoir y revenir, donc
 * figer ressemblait à une archive morte plutôt qu'à un point de reprise. La
 * version 1.4 part chez Apple, deux semaines d'essais la défont, et il faut
 * pouvoir repartir de ce qui a été livré plutôt que d'annuler à l'aveugle.
 *
 * **La release n'est pas modifiée, et ne le sera jamais.** La copie va dans un
 * seul sens : l'instantané est cloné *vers* le projet. C'est exactement ce que
 * l'invariant « une release est figée, pas suivie » demande — ce qui est
 * interdit, c'est qu'un lot livré change dans le dos de qui l'a relu.
 *
 * Ce qui reste hors de l'instantané reste en place : les autres releases, les
 * langues, l'identité du projet. Un instantané ne les a jamais portées, et
 * reprendre une composition n'est pas revenir en arrière dans le temps.
 */
export function restoreRelease(release: Release): TransactionOutcome<number> {
  return runEditorTransaction((draft) => {
    const snapshot = structuredClone(release.snapshot)
    if (snapshot.screens.length === 0) return ABORT
    draft.name = snapshot.name
    draft.profileId = snapshot.profileId
    draft.screens = snapshot.screens
    draft.layoutLayers = snapshot.layoutLayers
    draft.globals = snapshot.globals
    /* L'écran courant n'entre pas dans l'instantané : c'est une position de
       lecture, pas une donnée du lot. Sans ce rattrapage il pointait vers un
       écran que la reprise venait de faire disparaître, et le canevas rendait
       du vide en affirmant qu'un écran était sélectionné. */
    if (!snapshot.screens.some((screen) => screen.id === draft.activeScreenId)) {
      draft.activeScreenId = snapshot.screens[0].id
    }
    return snapshot.screens.length
  })
}

export type ReleaseFileStatus = 'ok' | 'changed' | 'failed'

export interface ReleaseCheck {
  path: string
  status: ReleaseFileStatus
  detail?: string
}

/**
 * Rejoue la release et compare les empreintes, fichier par fichier.
 *
 * Elle ne lit jamais le projet vivant : c'est l'instantané figé qui est rendu,
 * donc une planche modifiée depuis ne peut pas faire échouer la vérification.
 * Ce qu'elle attrape est ce qui a changé *sous* le projet — une police qui ne
 * se charge plus, un cadre d'appareil remplacé, un moteur de rendu qui a
 * bougé.
 */
export async function verifyRelease(
  release: Release,
  onProgress?: (progress: RenderProgress) => void,
  dimensions: DisplayClass[] = EXPORT_DIMENSIONS,
): Promise<ReleaseCheck[]> {
  if (release.watermarked) {
    return release.files.map((file) => ({
      path: file.path,
      status: 'failed',
      detail: 'Lot historique filigrané : régénérez une release propre.',
    }))
  }
  let rendered: ReleaseFile[]
  try {
    rendered = await renderReleaseFiles(release.snapshot, onProgress, dimensions)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Rendu impossible.'
    return release.files.map((file) => ({ path: file.path, status: 'failed', detail }))
  }

  const byPath = new Map(rendered.map((file) => [file.path, file]))
  return release.files.map((file) => {
    const fresh = byPath.get(file.path)
    if (!fresh) return { path: file.path, status: 'failed', detail: 'Planche absente du rendu.' }
    if (fresh.sha256 === file.sha256) return { path: file.path, status: 'ok' }
    return {
      path: file.path,
      status: 'changed',
      detail: `${file.sha256.slice(0, 12)} → ${fresh.sha256.slice(0, 12)}`,
    }
  })
}

/* ------------------------------------------------------------------ diff */

export type LayerChangeKind = 'added' | 'removed' | 'changed'

export interface LayerChange {
  layerId: string
  name: string
  kind: LayerChangeKind
  /** Propriétés modifiées, triées — vide pour un ajout ou un retrait. */
  props: string[]
}

export interface ScreenDiff {
  screenId: string
  name: string
  added: boolean
  removed: boolean
  renamedFrom?: string
  backgroundChanged: boolean
  layers: LayerChange[]
}

export interface StructuralDiff {
  identical: boolean
  screens: ScreenDiff[]
  layoutLayers: LayerChange[]
  /** Clés de `globals` modifiées, triées. */
  globals: string[]
  projectRenamed?: { from: string; to: string }
}

/** Comparaison stable : un objet dont les clés sont dans un autre ordre est le même. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
}

function changedProps(before: Layer, after: Layer): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    const left = (before as unknown as Record<string, unknown>)[key]
    const right = (after as unknown as Record<string, unknown>)[key]
    if (stable(left) !== stable(right)) changed.push(key)
  }
  return changed.sort()
}

/**
 * Les calques de `after` d'abord, dans leur ordre ; les disparus ensuite.
 *
 * L'ordre est ce qui rend le diff relisible : la liste suit ce que
 * l'utilisateur a sous les yeux, et ce qui n'y est plus arrive à la fin.
 */
function diffLayers(before: Layer[], after: Layer[]): LayerChange[] {
  const byIdBefore = new Map(before.map((layer) => [layer.id, layer]))
  const seen = new Set<string>()
  const changes: LayerChange[] = []

  for (const layer of after) {
    seen.add(layer.id)
    const previous = byIdBefore.get(layer.id)
    if (!previous) {
      changes.push({ layerId: layer.id, name: layer.name, kind: 'added', props: [] })
      continue
    }
    const props = changedProps(previous, layer)
    if (props.length > 0) {
      changes.push({ layerId: layer.id, name: layer.name, kind: 'changed', props })
    }
  }

  for (const layer of before) {
    if (!seen.has(layer.id)) {
      changes.push({ layerId: layer.id, name: layer.name, kind: 'removed', props: [] })
    }
  }

  return changes
}

function changedGlobals(before: GlobalSettings, after: GlobalSettings): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys]
    .filter(
      (key) =>
        stable((before as unknown as Record<string, unknown>)[key]) !==
        stable((after as unknown as Record<string, unknown>)[key]),
    )
    .sort()
}

/** Ce qui a changé entre deux instantanés, dans un ordre qui ne dépend de rien. */
export function diffSnapshots(before: ProjectSnapshot, after: ProjectSnapshot): StructuralDiff {
  const byIdBefore = new Map(before.screens.map((screen) => [screen.id, screen]))
  const seen = new Set<string>()
  const screens: ScreenDiff[] = []

  for (const screen of after.screens) {
    seen.add(screen.id)
    const previous = byIdBefore.get(screen.id)
    if (!previous) {
      screens.push({
        screenId: screen.id,
        name: screen.name,
        added: true,
        removed: false,
        backgroundChanged: false,
        layers: [],
      })
      continue
    }
    const layers = diffLayers(previous.layers, screen.layers)
    const backgroundChanged = stable(previous.background) !== stable(screen.background)
    const renamed = previous.name !== screen.name
    if (layers.length === 0 && !backgroundChanged && !renamed) continue
    screens.push({
      screenId: screen.id,
      name: screen.name,
      added: false,
      removed: false,
      ...(renamed ? { renamedFrom: previous.name } : {}),
      backgroundChanged,
      layers,
    })
  }

  for (const screen of before.screens) {
    if (seen.has(screen.id)) continue
    screens.push({
      screenId: screen.id,
      name: screen.name,
      added: false,
      removed: true,
      backgroundChanged: false,
      layers: [],
    })
  }

  const layoutLayers = diffLayers(before.layoutLayers, after.layoutLayers)
  const globals = changedGlobals(before.globals, after.globals)
  const projectRenamed =
    before.name === after.name ? undefined : { from: before.name, to: after.name }

  return {
    identical:
      screens.length === 0 && layoutLayers.length === 0 && globals.length === 0 && !projectRenamed,
    screens,
    layoutLayers,
    globals,
    ...(projectRenamed ? { projectRenamed } : {}),
  }
}

/** Le nombre de changements, pour une phrase de résumé. */
export function countChanges(diff: StructuralDiff): number {
  return (
    diff.screens.reduce(
      (total, screen) =>
        total +
        (screen.added || screen.removed || screen.renamedFrom || screen.backgroundChanged ? 1 : 0) +
        screen.layers.length,
      0,
    ) +
    diff.layoutLayers.length +
    diff.globals.length +
    (diff.projectRenamed ? 1 : 0)
  )
}
