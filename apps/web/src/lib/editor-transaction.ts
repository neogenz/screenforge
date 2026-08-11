import { collectAssetIds } from '@/lib/asset-refs'
import { isProject } from '@/lib/project-validation'
import { nextTimestamp } from '@/lib/time'
import { useCanvasStore } from '@/stores/canvas.store'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import type { Project } from '@/types'

/**
 * La mutation multi-écrans, tout ou rien.
 *
 * Les actions de `project.store` écrivent un champ à la fois et horodatent à
 * chaque appel. C'est ce qu'il faut quand l'utilisateur tire un curseur ; c'est
 * exactement ce qu'il ne faut pas quand dix captures sont remplacées d'un coup :
 * dix pas d'annulation pour un geste, dix références de projet donc dix
 * synchronisations, et un échec au sixième fichier qui laisse le projet à
 * mi-chemin entre deux releases. Cette primitive est l'inverse — le lot est
 * préparé entièrement à côté, validé, puis publié en une seule écriture.
 *
 * Le rédacteur reçoit un clone, jamais l'état vivant : ce qu'il abîme avant de
 * renoncer n'a jamais existé pour le reste de l'application.
 *
 * Elle ne balaie pas les assets devenus orphelins, et c'est délibéré. Une
 * capture d'historique antérieure les référence encore, et les effacer ferait
 * d'une annulation un calque au contenu manquant. Le balayage n'est correct
 * qu'au chargement, là où `loadProjectRecord` le fait pendant que la pile
 * d'annulation vient d'être vidée (`storage.ts`). Le lot est donc rendu ici, et
 * l'appelant qui a besoin de savoir ce qu'il a créé ou détaché le lit sans que
 * rien ne soit supprimé.
 */

/** Renvoyé par la mutation pour renoncer sans rien écrire. */
export const ABORT = Symbol('editor-transaction-abort')

export type TransactionFailure =
  /** Aucun projet ouvert. */
  | 'no-project'
  /** La mutation a renoncé d'elle-même. */
  | 'aborted'
  /** Le brouillon ne satisfait pas le contrat du projet. */
  | 'invalid'
  /** La mutation a levé. */
  | 'threw'

export type TransactionOutcome<T> =
  | {
      committed: true
      value: T
      /** Assets référencés après le lot et qui ne l'étaient pas avant. */
      addedAssetIds: string[]
      /** Assets référencés avant le lot et qui ne le sont plus. */
      orphanedAssetIds: string[]
    }
  | { committed: false; reason: TransactionFailure; error?: unknown }

function layerIds(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const screen of project.screens) {
    for (const layer of screen.layers) ids.add(layer.id)
  }
  for (const layer of project.layoutLayers) ids.add(layer.id)
  return ids
}

/**
 * Une sélection est une vue, pas une donnée du projet : elle ne descend donc
 * pas dans la capture d'historique. Mais un lot qui supprime un calque laisse
 * son identifiant dans la sélection, et la barre de propriétés s'ouvre alors
 * sur un calque qui n'existe plus. On coupe ce qui a disparu, on garde le
 * reste — vider systématiquement ferait perdre sa sélection à un utilisateur
 * dont le lot n'a touché aucun de ses calques.
 */
function pruneSelection(project: Project): void {
  const { selectedLayerIds } = useCanvasStore.getState()
  if (selectedLayerIds.length === 0) return
  const surviving = layerIds(project)
  const kept = selectedLayerIds.filter((id) => surviving.has(id))
  if (kept.length !== selectedLayerIds.length) useCanvasStore.setState({ selectedLayerIds: kept })
}

/**
 * Applique `mutate` sur un brouillon et ne publie que s'il tient debout.
 *
 * En cas de succès : une seule capture d'historique (l'état d'avant), une seule
 * nouvelle référence de projet, un seul horodatage.
 */
export function runEditorTransaction<T>(
  mutate: (draft: Project) => T | typeof ABORT,
  /**
   * Regroupe les rafales sous un seul pas d'annulation, comme le font les
   * éditeurs de panneau. Une transaction par frappe est correcte pour le projet
   * et intenable pour l'historique : vingt ⌘Z pour défaire un mot.
   */
  coalesceKey?: string,
): TransactionOutcome<T> {
  const before = useProjectStore.getState().project
  if (!before) return { committed: false, reason: 'no-project' }

  const draft = structuredClone(before)
  let value: T | typeof ABORT
  try {
    value = mutate(draft)
  } catch (error) {
    return { committed: false, reason: 'threw', error }
  }
  if (value === ABORT) return { committed: false, reason: 'aborted' }

  /* L'identité et la chronologie du projet n'appartiennent pas au rédacteur :
     un lot qui réécrirait `id` ferait deux projets là où l'utilisateur en voit
     un, et `nextTimestamp` est ce qui garde la synchronisation monotone. */
  const after: Project = {
    ...draft,
    id: before.id,
    createdAt: before.createdAt,
    updatedAt: nextTimestamp(before.updatedAt),
    activeScreenId: draft.screens.some((screen) => screen.id === draft.activeScreenId)
      ? draft.activeScreenId
      : (draft.screens[0]?.id ?? before.activeScreenId),
  }
  if (!isProject(after)) return { committed: false, reason: 'invalid' }

  const usedBefore = collectAssetIds(before)
  const usedAfter = collectAssetIds(after)

  useHistoryStore.getState().record({ kind: 'project', project: before }, coalesceKey)
  useProjectStore.setState({ project: after })
  pruneSelection(after)

  return {
    committed: true,
    value,
    addedAssetIds: [...usedAfter].filter((id) => !usedBefore.has(id)),
    orphanedAssetIds: [...usedBefore].filter((id) => !usedAfter.has(id)),
  }
}
