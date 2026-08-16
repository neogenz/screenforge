import { ABORT, runEditorTransaction, type TransactionOutcome } from '@/lib/editor-transaction'
import { normalizeSlot } from '@/lib/slots'
import type { Layer, Project, ScreenshotSize } from '@/types'

/**
 * L'appariement d'une nouvelle livraison de captures aux appareils qui les
 * portent, puis sa pose en une seule écriture.
 *
 * Une convention de nom et une correction manuelle suffisent : ni OCR, ni
 * modèle de langage. `budget.png` va sur les appareils dont le rôle est
 * `budget`, et ce que la règle n'atteint pas se règle à la main, dans un
 * tableau qui montre aussi ce qui n'a rien trouvé. Tout le haut du module est
 * pur — il calcule un plan sans toucher au projet — et `applyRefresh` est le
 * seul point qui écrit, à travers la transaction de la phase 1.
 */

export type MatchReason = 'manifest' | 'slot' | 'manual' | 'none'

export interface RefreshTarget {
  layerId: string
  slot?: string
  layerName: string
  screenId: string
  screenName: string
  /** Rang de l'écran, 1-based — ce que l'utilisateur lit sur la pellicule. */
  screenRank: number
  scope: 'screen' | 'layout'
  currentAssetId?: string
}

export interface RefreshFile {
  name: string
  /** Rôle déduit du nom de fichier, ou du manifeste s'il en existe un. */
  slot?: string
}

export interface RefreshAssignment {
  layerId: string
  /** Index dans la liste de fichiers, ou `undefined` si rien ne vient ici. */
  fileIndex?: number
  reason: MatchReason
}

export interface RefreshPlan {
  assignments: RefreshAssignment[]
  /** Fichiers qu'aucun appareil ne réclame. */
  unusedFileIndexes: number[]
  /** Appareils dont le rôle n'a trouvé aucun fichier. */
  unmatchedLayerIds: string[]
  /** Rôles réclamés par plusieurs fichiers : aucun n'est posé d'office. */
  duplicateSlots: { slot: string; fileIndexes: number[] }[]
  /** Appareils sans rôle : jamais appariés automatiquement. */
  slotlessLayerIds: string[]
}

/** Nom de fichier sans extension ni chemin. */
export function basename(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? name
  return last.replace(/\.[^.]+$/, '')
}

/** Les appareils du projet, dans l'ordre où l'utilisateur les voit. */
export function refreshTargets(project: Project): RefreshTarget[] {
  const targets: RefreshTarget[] = []
  project.screens.forEach((screen, index) => {
    for (const layer of screen.layers) {
      if (layer.type !== 'device-frame') continue
      targets.push({
        layerId: layer.id,
        slot: layer.slot,
        layerName: layer.name,
        screenId: screen.id,
        screenName: screen.name,
        screenRank: index + 1,
        scope: 'screen',
        currentAssetId: layer.screenshotAssetId,
      })
    }
  })
  for (const layer of project.layoutLayers) {
    if (layer.type !== 'device-frame') continue
    targets.push({
      layerId: layer.id,
      slot: layer.slot,
      layerName: layer.name,
      screenId: '',
      screenName: 'Tous les écrans',
      screenRank: 0,
      scope: 'layout',
      currentAssetId: layer.screenshotAssetId,
    })
  }
  return targets
}

/**
 * Le rôle d'un fichier : le manifeste d'abord, son nom ensuite.
 *
 * Un manifeste est un objet `{ slot: nomDeFichier }` livré avec le lot ; il
 * existe pour les exports automatisés, dont les noms de fichiers sont des
 * horodatages qu'aucune règle ne saurait lire.
 */
export function fileSlot(name: string, manifest?: Record<string, string>): string | undefined {
  if (manifest) {
    const leaf = name.split(/[\\/]/).pop() ?? name
    for (const [slot, target] of Object.entries(manifest)) {
      if (target === name || target === leaf) return normalizeSlot(slot)
    }
  }
  return normalizeSlot(basename(name))
}

export function describeFiles(names: string[], manifest?: Record<string, string>): RefreshFile[] {
  return names.map((name) => ({ name, slot: fileSlot(name, manifest) }))
}

/**
 * Le plan proposé, avant toute correction manuelle.
 *
 * Un même fichier peut servir plusieurs appareils : la même capture apparaît
 * souvent sur deux planches, et c'est le cas normal, pas une ambiguïté. Deux
 * fichiers pour un même rôle, en revanche, est une ambiguïté : aucun des deux
 * n'est posé, et le tableau la montre plutôt que de trancher au hasard.
 */
export function planRefresh(
  targets: RefreshTarget[],
  files: RefreshFile[],
  manifest?: Record<string, string>,
): RefreshPlan {
  const bySlot = new Map<string, number[]>()
  const addCandidate = (slot: string, position: number) => {
    const bucket = bySlot.get(slot)
    if (bucket) bucket.push(position)
    else bySlot.set(slot, [position])
  }
  files.forEach((file, position) => {
    if (!file.slot) return
    addCandidate(file.slot, position)
    /* Un simulateur numérote pour ordonner : `01_Budget.png`, `02_Reglages.png`.
       Le rang appartient à la livraison, pas au rôle, donc le fichier est aussi
       classé sans son préfixe. Deux fichiers qui retombent alors sur le même
       rôle deviennent une ambiguïté visible, jamais un choix silencieux. */
    const withoutRank = file.slot.replace(/^\d+-/, '')
    if (withoutRank && withoutRank !== file.slot) addCandidate(withoutRank, position)
  })

  const claimed = new Set(targets.flatMap((target) => (target.slot ? [target.slot] : [])))
  const duplicateSlots = [...bySlot]
    .filter(([slot, indexes]) => indexes.length > 1 && claimed.has(slot))
    .map(([slot, fileIndexes]) => ({ slot, fileIndexes }))

  const used = new Set<number>()
  const assignments = targets.map<RefreshAssignment>((target) => {
    if (!target.slot) return { layerId: target.layerId, reason: 'none' }
    const candidates = bySlot.get(target.slot)
    if (!candidates || candidates.length !== 1) return { layerId: target.layerId, reason: 'none' }
    used.add(candidates[0])
    return {
      layerId: target.layerId,
      fileIndex: candidates[0],
      reason: manifest ? 'manifest' : 'slot',
    }
  })

  return {
    assignments,
    unusedFileIndexes: files.map((_, index) => index).filter((index) => !used.has(index)),
    unmatchedLayerIds: assignments
      .filter((assignment, index) => assignment.fileIndex === undefined && targets[index].slot)
      .map((assignment) => assignment.layerId),
    duplicateSlots,
    slotlessLayerIds: targets.filter((target) => !target.slot).map((target) => target.layerId),
  }
}

/** Repose un appariement à la main ; le reste du plan se recalcule autour. */
export function assignManually(
  plan: RefreshPlan,
  targets: RefreshTarget[],
  files: RefreshFile[],
  layerId: string,
  fileIndex: number | undefined,
): RefreshPlan {
  const assignments = plan.assignments.map<RefreshAssignment>((assignment) =>
    assignment.layerId === layerId
      ? { layerId, fileIndex, reason: fileIndex === undefined ? 'none' : 'manual' }
      : assignment,
  )
  const used = new Set(
    assignments.flatMap((assignment) =>
      assignment.fileIndex === undefined ? [] : [assignment.fileIndex],
    ),
  )
  const slotById = new Map(targets.map((target) => [target.layerId, target.slot]))
  return {
    ...plan,
    assignments,
    unusedFileIndexes: files.map((_, index) => index).filter((index) => !used.has(index)),
    unmatchedLayerIds: assignments
      .filter(
        (assignment) => assignment.fileIndex === undefined && slotById.get(assignment.layerId),
      )
      .map((assignment) => assignment.layerId),
  }
}

/** Ce qu'une confirmation écrira réellement. */
export function pendingChanges(plan: RefreshPlan): RefreshAssignment[] {
  return plan.assignments.filter((assignment) => assignment.fileIndex !== undefined)
}

/** Une capture déjà décodée et enregistrée, prête à être posée. */
export interface ImportedScreenshot {
  assetId: string
  size: ScreenshotSize
}

function findLayer(draft: Project, id: string): Layer | undefined {
  for (const screen of draft.screens) {
    const found = screen.layers.find((layer) => layer.id === id)
    if (found) return found
  }
  return draft.layoutLayers.find((layer) => layer.id === id)
}

/**
 * Pose le lot : un pas d'annulation, une référence de projet, un horodatage.
 *
 * Seuls l'asset et sa mesure changent. Le cadrage, le rôle, la géométrie,
 * l'appareil et l'ombre restent tels quels — c'est toute la raison d'être de
 * la phase 2, et le point où Open Screenshot Generator remet le cadrage à zéro
 * à chaque release.
 *
 * Un appareil disparu annule tout le lot plutôt que d'en poser la moitié : la
 * boîte reste ouverte pendant que l'éditeur vit, et un calque supprimé entre
 * l'aperçu et la confirmation rendrait le lot différent de ce qui a été
 * relu.
 */
export function applyRefresh(
  assignments: RefreshAssignment[],
  screenshots: ImportedScreenshot[],
): TransactionOutcome<number> {
  const posed = assignments.filter((assignment) => assignment.fileIndex !== undefined)
  if (posed.length === 0) return { committed: false, reason: 'aborted' }

  return runEditorTransaction((draft) => {
    for (const assignment of posed) {
      const screenshot = screenshots[assignment.fileIndex as number]
      const layer = findLayer(draft, assignment.layerId)
      if (!screenshot || layer?.type !== 'device-frame') return ABORT
      layer.screenshotAssetId = screenshot.assetId
      layer.screenshotSize = { ...screenshot.size }
    }
    return posed.length
  })
}
