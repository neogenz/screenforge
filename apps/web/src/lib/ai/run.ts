import { forgetAssets } from '@/lib/assets'
import { collectAssetIds } from '@/lib/asset-refs'
import { ABORT, runEditorTransaction } from '@/lib/editor-transaction'
import { applyToolCalls, type ToolCall, type ToolContext, type ToolResult } from '@/lib/ai/tools'
import { planFromBrief, type CampaignBrief, type CampaignPlan } from '@/lib/ai/plan'
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

/**
 * Compose le plan.
 *
 * Asynchrone alors que la composition locale est immédiate : c'est la couture
 * où un fournisseur distant se branchera (phase 7), et une boîte de dialogue
 * qui attend déjà n'aura rien à réapprendre ce jour-là.
 */
export async function planCampaign(brief: CampaignBrief): Promise<CampaignPlan> {
  return planFromBrief(brief)
}
