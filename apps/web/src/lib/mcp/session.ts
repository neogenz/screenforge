import { commitAiRun } from '@/lib/ai/run'
import { describeProject, type ProjectView } from '@/lib/ai/state'
import type { ToolCall } from '@/lib/ai/tools'
import { useProjectStore } from '@/stores/project.store'
import { useMcpStore } from '@/stores/mcp.store'

/**
 * Ce qu'un lot venu de l'agent devient dans le projet : une écriture, ou rien.
 *
 * Aucun chemin de mutation nouveau. Un lot MCP passe exactement là où passe une
 * campagne générée dans l'application — `commitAiRun`, donc
 * `runEditorTransaction` : les appels s'appliquent sur un clone, la validation
 * du projet juge le résultat, et le tout devient une seule référence de projet
 * et un seul pas d'annulation. C'est ce qui rend le ⌘Z honnête : un agent qui
 * pose un fond, trois textes et un appareil ne coûte pas cinq annulations à
 * défaire, il en coûte une, comme le geste qui l'a demandé.
 *
 * Le refus est entier lui aussi. Un lot dont le sixième appel ne valide pas ne
 * laisse pas cinq écrans à moitié composés : il ne laisse rien, et l'agent
 * reçoit le message du validateur — celui qui nomme les valeurs admises.
 */

export interface RelayOutcome {
  committed: boolean
  /** Rendu à l'agent tel quel quand le lot est passé. */
  result?: { results: unknown[]; screenIds: string[]; layerIds: string[] }
  /** Le message du validateur, quand il ne l'est pas. */
  error?: string
}

export function applyRelayBatch(calls: readonly ToolCall[]): RelayOutcome {
  const run = commitAiRun(calls)
  if (!run.committed) return { committed: false, error: run.error ?? 'Le lot a été refusé.' }

  useMcpStore.getState().noteBatch(calls.length)
  return {
    committed: true,
    result: { results: run.results, screenIds: run.screenIds, layerIds: run.layerIds },
  }
}

/**
 * Ce que le démon a le droit de savoir du projet.
 *
 * La même vue que celle envoyée à un fournisseur distant, et pour la même
 * raison : jamais de data URL, jamais un objet Fabric, jamais l'état vivant.
 * Un asset n'y est décrit que par sa présence — le démon relaie, il ne stocke
 * pas les captures de l'utilisateur.
 */
export function readProjectState(): ProjectView | null {
  const project = useProjectStore.getState().project
  return project ? describeProject(project) : null
}
