import type { RelayRender, RelayRendered, RelayTemplateSave, RelayTemplateSummary } from 'mcp'
import type { CustomTemplate } from '@/lib/custom-templates'
import { useTemplatesStore } from '@/stores/templates.store'
import { commitAiRun } from '@/lib/ai/run'
import { reviewBoard } from '@/lib/ai/board-review'
import { describeProject, type ProjectView } from '@/lib/ai/state'
import type { ToolCall } from '@/lib/ai/tools'
import { resolveRelayAssets, type AssetFetcher } from '@/lib/mcp/assets'
import { renderScreenToBlob } from '@/lib/export'
import { SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
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
  /** Rendu à l'agent tel quel quand la demande aboutit. */
  result?: unknown
  /** Le message du validateur, quand elle n'aboutit pas. */
  error?: string
}

export async function applyRelayBatch(
  calls: readonly ToolCall[],
  fetchAsset: AssetFetcher,
): Promise<RelayOutcome> {
  /* Les images d'abord, hors transaction : télécharger est asynchrone et
     `runEditorTransaction` ne l'est pas. Une image manquante doit refuser le
     lot avant qu'il ne commence, pas le laisser à moitié posé. */
  const resolved = await resolveRelayAssets(calls, fetchAsset)
  if (resolved.error) return { committed: false, error: resolved.error }

  const run = commitAiRun(resolved.calls, { assetIds: resolved.assetIds })
  if (!run.committed) return { committed: false, error: run.error ?? 'Le lot a été refusé.' }

  useMcpStore.getState().noteBatch(calls.length)
  return {
    committed: true,
    result: { results: run.results, screenIds: run.screenIds, layerIds: run.layerIds },
  }
}

/**
 * L'écran rendu pour l'agent, sur une toile jetable.
 *
 * Le même moteur que l'export officiel, à un multiplicateur près : montrer à
 * l'agent autre chose que ce que l'export produira serait la seule façon de
 * rendre cette boucle nuisible. Rien n'est touché au passage — ni le projet, ni
 * l'historique, ni la sélection, ni la toile visible.
 */
export async function renderRelayScreen(render: RelayRender): Promise<RelayOutcome> {
  const project = useProjectStore.getState().project
  if (!project) return { committed: false, error: 'Aucun projet ouvert.' }

  const wanted = render.screenId ?? project.activeScreenId
  const index = project.screens.findIndex((screen) => screen.id === wanted)
  if (index < 0) {
    const known = project.screens.map((screen) => `${screen.id} (${screen.name})`).join(', ')
    return { committed: false, error: `Aucun écran « ${wanted} ». Écrans du projet : ${known}.` }
  }

  const screen = project.screens[index]
  const asked = Math.round(render.maxWidth ?? 640)
  try {
    const blob = await renderScreenToBlob(screen, project.layoutLayers, asked / SCREEN_WIDTH, index)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    /* Les dimensions sont relues dans l'IHDR, jamais recalculées depuis le
       multiplicateur : c'est la toile qui décide de l'arrondi, et un chiffre
       annoncé à un pixel du fichier ferait mesurer l'agent sur du faux. */
    const size = new DataView(bytes.buffer)
    return {
      committed: true,
      result: {
        screenId: screen.id,
        width: size.getUint32(16),
        height: size.getUint32(20),
        data: base64(bytes),
        /* Mesuré après le rendu, sur les mêmes calques : la revue ne juge pas
           l'image, elle mesure la planche que l'image montre. Elle n'écrit
           rien — ni projet, ni historique, ni sélection — donc `get_thumbnail`
           reste la lecture qu'il annonce être. */
        findings: reviewBoard(screen, project.layoutLayers).map((finding) => finding.detail),
      } satisfies RelayRendered,
    }
  } catch (error) {
    return {
      committed: false,
      error: error instanceof Error ? error.message : 'Rendu impossible.',
    }
  }
}

/** Par tranches : `fromCharCode` sur un mégapixel dépasse la pile d'appels. */
function base64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }
  return btoa(binary)
}

/**
 * Le gabarit que l'agent demande de garder.
 *
 * Rien n'est écrit dans le projet : un gabarit vit à côté, dans la bibliothèque
 * du navigateur, et c'est ce qui le rend réutilisable dans le projet suivant.
 * Il n'y a donc ni transaction, ni pas d'annulation — supprimer un gabarit se
 * fait dans le sélecteur, pas au ⌘Z.
 */
export async function saveRelayTemplate(input: RelayTemplateSave): Promise<RelayOutcome> {
  const outcome = await useTemplatesStore.getState().save({ ...input, source: 'ai' })
  if (!outcome.ok) return { committed: false, error: outcome.error }
  return { committed: true, result: summarize(outcome.template) }
}

export function listRelayTemplates(): RelayOutcome {
  return {
    committed: true,
    result: { templates: useTemplatesStore.getState().templates.map(summarize) },
  }
}

/** La fiche, jamais les calques : l'agent choisit un gabarit, il ne le relit pas. */
function summarize(template: CustomTemplate): RelayTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    source: template.source,
    layerCount: template.layers.length,
    createdAt: template.createdAt,
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
