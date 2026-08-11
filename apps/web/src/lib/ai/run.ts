import { forgetAssets } from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import { ABORT, runEditorTransaction } from '@/lib/editor-transaction'
import { applyToolCalls, type ToolCall, type ToolContext, type ToolResult } from '@/lib/ai/tools'
import { planFromBrief, type CampaignBrief, type CampaignPlan } from '@/lib/ai/plan'
import { planViaBridge } from '@/lib/bridge-client'
import type { ProviderId } from '@/lib/ai/providers'
import { useProjectStore } from '@/stores/project.store'

/**
 * Un run accepté est une écriture ; un run refusé n'a jamais eu lieu.
 *
 * Tout passe par `runEditorTransaction` : le lot entier d'appels s'applique sur
 * un clone, la validation du projet le juge, et il devient une seule référence
 * de projet et un seul pas d'annulation. Vingt calques posés par un modèle se
 * défont donc du même ⌘Z que le geste qui les a demandés — sans quoi
 * l'utilisateur devrait annuler vingt fois pour revenir en arrière, ce qui
 * revient à ne pas pouvoir revenir en arrière.
 */

export interface AiRunOutcome {
  committed: boolean
  error?: string
  results: ToolResult[]
  /** Écrans et calques créés, pour que la boîte montre ce qu'elle a fait. */
  screenIds: string[]
  layerIds: string[]
}

export function commitAiRun(calls: readonly ToolCall[], context: ToolContext = {}): AiRunOutcome {
  let failure: string | undefined
  let executed: ToolResult[] = []

  const outcome = runEditorTransaction((draft) => {
    const execution = applyToolCalls(draft, calls, context)
    if (execution.error) {
      failure = execution.error
      return ABORT
    }
    executed = execution.results
    return execution.results.length
  })

  if (!outcome.committed) {
    return {
      committed: false,
      error: failure ?? refusal(outcome.reason),
      results: [],
      screenIds: [],
      layerIds: [],
    }
  }

  return {
    committed: true,
    results: executed,
    screenIds: [
      ...new Set(executed.flatMap((result) => (result.screenId ? [result.screenId] : []))),
    ],
    layerIds: executed.flatMap((result) => (result.layerId ? [result.layerId] : [])),
  }
}

function refusal(reason: string): string {
  if (reason === 'no-project') return 'Aucun projet ouvert.'
  if (reason === 'invalid') return 'Le résultat ne satisfait pas le contrat du projet.'
  return 'La génération a échoué.'
}

/**
 * Rend au néant les captures importées pour un run abandonné.
 *
 * Elles sont enregistrées dès l'import, parce que le plan a besoin de leurs
 * dimensions pour cadrer. Si l'utilisateur referme sans accepter, plus rien ne
 * les référence : les garder ferait grossir IndexedDB d'un mégaoctet par essai,
 * pour des images qu'aucun écran ne montre. Celles qu'un run accepté a posées
 * sont protégées par le projet lui-même.
 */
export function discardAiAssets(assetIds: readonly string[]): void {
  const project = useProjectStore.getState().project
  forgetAssets(assetIds, project ? collectAssetIds(project) : new Set())
}

export interface PlanSource {
  provider: ProviderId
  /** Le jeton d'appairage du pont, en mémoire seulement. Voir `bridge-client`. */
  token?: string
  model?: string
}

/**
 * Compose le plan, quel que soit celui qui parle.
 *
 * Un seul point d'entrée pour les deux fournisseurs, et une seule sortie : un
 * `CampaignPlan` que l'appelant revalide. Le pont sans jeton retombe sur la
 * composition locale plutôt que d'échouer — un fournisseur choisi mais pas
 * connecté ne doit pas coûter à l'utilisateur le plan qu'il attendait.
 */
export async function planCampaign(
  brief: CampaignBrief,
  source: PlanSource = { provider: 'local' },
): Promise<CampaignPlan> {
  if (source.provider === 'codex-bridge' && source.token) {
    return planViaBridge(brief, source.token, source.model)
  }
  return planFromBrief(brief)
}
