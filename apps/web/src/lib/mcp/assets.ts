import { registerAsset, resolveAsset } from '@/lib/assets'
import { MAX_IMAGE_FILE_BYTES, MAX_IMAGE_PIXELS } from '@/lib/image'
import type { ToolCall } from '@/lib/ai/tools'

/**
 * Les images que l'agent a désignées, récupérées avant que rien ne soit écrit.
 *
 * Un appel venu du MCP porte l'identifiant du **coffre du démon**, pas celui du
 * registre de cette page : le démon a lu un fichier local, la page ne connaît
 * pas ce fichier. La résolution se fait donc en amont de la transaction — tout
 * ce qui doit échouer échoue avant `commitAiRun`, et le projet ne voit jamais
 * un lot à moitié pourvu.
 *
 * Aucun préfixe magique ne distingue les deux familles d'identifiants : ce qui
 * est déjà dans le registre local y reste, le reste est demandé au démon. Un
 * identifiant que ni l'un ni l'autre ne connaît est un refus nommé, pas une
 * image manquante découverte au rendu.
 *
 * Les bornes sont celles de l'import à la souris — même produit, mêmes limites.
 * Le démon a déjà refusé au-delà de 16 Mo ; la page revérifie parce qu'elle est
 * le seul endroit qui décode réellement, et parce qu'un octet de trop finit
 * dans IndexedDB, pas dans un processus qu'on relance.
 */

export type AssetFetcher = (id: string) => Promise<Blob>

/**
 * Le seul champ du contrat qui désigne une image — `add_image`, `add_device`
 * et `place_screenshot_asset` le nomment tous les trois pareil.
 */
const ASSET_KEY = 'assetId'

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('illisible'))
    reader.onerror = () => reject(new Error('illisible'))
    reader.readAsDataURL(blob)
  })
}

function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('illisible'))
    image.src = dataUrl
  })
}

export interface ResolvedAssets {
  calls: readonly ToolCall[]
  /** L'allowlist que `applyToolCalls` exige : rien d'autre ne sera posé. */
  assetIds: string[]
  error?: string
}

/**
 * Remplace chaque identifiant étranger par celui du registre local.
 *
 * Les appels sont clonés : un lot refusé ne doit pas laisser derrière lui des
 * arguments à moitié réécrits, et le lot d'origine appartient au flux, pas à
 * cette fonction.
 */
export async function resolveRelayAssets(
  calls: readonly ToolCall[],
  fetchAsset: AssetFetcher,
): Promise<ResolvedAssets> {
  const resolved: ToolCall[] = calls.map((call) => ({
    tool: call.tool,
    args: { ...(call.args ?? {}) },
  }))
  const assetIds = new Set<string>()
  /* Un même fichier posé sur trois écrans est une seule requête et un seul
     enregistrement : le registre déduplique déjà par contenu, mais pas avant
     d'avoir téléchargé trois fois. */
  const seen = new Map<string, string>()

  for (const call of resolved) {
    const id = call.args[ASSET_KEY]
    if (typeof id !== 'string' || id.length === 0) continue
    if (resolveAsset(id)) {
      assetIds.add(id)
      continue
    }

    const known = seen.get(id)
    if (known) {
      call.args[ASSET_KEY] = known
      assetIds.add(known)
      continue
    }

    let localId: string
    try {
      const blob = await fetchAsset(id)
      if (blob.size > MAX_IMAGE_FILE_BYTES) {
        return { calls, assetIds: [], error: 'L’image dépasse la taille maximale de 16 Mio.' }
      }
      const dataUrl = await blobToDataUrl(blob)
      const size = await measure(dataUrl)
      if (!size.width || !size.height) throw new Error('illisible')
      if (size.width > Math.floor(MAX_IMAGE_PIXELS / size.height)) {
        return { calls, assetIds: [], error: 'L’image dépasse la limite de 16 mégapixels.' }
      }
      localId = registerAsset(dataUrl)
    } catch {
      return {
        calls,
        assetIds: [],
        error: `Image « ${id} » introuvable ou illisible. Reposez-la avec screenforge_add_image.`,
      }
    }

    seen.set(id, localId)
    call.args[ASSET_KEY] = localId
    assetIds.add(localId)
  }

  return { calls: resolved, assetIds: [...assetIds] }
}
