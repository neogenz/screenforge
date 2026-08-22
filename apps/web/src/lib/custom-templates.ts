import { registerAsset, resolveAsset } from '@/lib/assets'
import { collectLayerAssetIds } from '@/lib/asset-refs'
import { isProject } from '@/lib/project-validation'
import { getDB } from '@/lib/storage'
import {
  DEFAULT_APP_STORE_PROFILE_ID,
  isAppStoreProfileId,
  type AppStoreProfileId,
} from '@/lib/dimensions'
import { DEFAULT_GLOBALS } from '@/stores/project.store'
import type { Layer, Screen, TemplateDefinition } from '@/types'

/**
 * Les gabarits que l'utilisateur — ou son agent — a faits lui-même.
 *
 * `TEMPLATES` est du code : cinq compositions figées, livrées avec l'app. Un
 * gabarit enregistré est une donnée, et la différence n'est pas cosmétique.
 * L'intérêt d'un agent qui compose dix visuels n'est pas le lot lui-même, c'est
 * la mise en page qu'il a trouvée au troisième essai — et sans un endroit où la
 * poser, elle meurt avec le projet. C'est aussi ce qui la rend réutilisable dans
 * le projet suivant, où le catalogue livré, lui, ne sait rien de cette app.
 *
 * **Un gabarit porte ses images avec lui.** Le registre d'assets est balayé au
 * chargement de chaque projet — `sweepAssets` ne garde que ce que le projet
 * référence — donc un gabarit qui ne retiendrait qu'un `assetId` rendrait un
 * logo vide au prochain démarrage, sans que rien ne le dise. Les octets sont
 * donc recopiés dans l'enregistrement, et ré-enregistrés à l'application, où la
 * déduplication par contenu les fera retomber sur le même identifiant si
 * l'image est déjà là.
 *
 * **Sauf la capture d'écran.** Elle appartient à la fiche, pas à la mise en
 * page : un gabarit qui la porterait ferait porter à chaque écran construit
 * depuis lui la capture d'un autre. Le cadre reste, son contenu est remis à
 * vide, et `batch-refresh` est ce qui le remplit.
 */

/** Assez pour une bibliothèque personnelle, pas assez pour un dépotoir. */
export const MAX_CUSTOM_TEMPLATES = 30
export const MAX_TEMPLATE_NAME_LENGTH = 60
export const MAX_TEMPLATE_DESCRIPTION_LENGTH = 200

export interface CustomTemplate extends TemplateDefinition {
  /** Qui l'a posé. L'interface le dit, elle ne le devine pas. */
  source: 'ai' | 'user'
  createdAt: number
  /** `assetId` → data URL, pour les images que la mise en page porte. */
  assets: Record<string, string>
}

/**
 * Un gabarit est jugé par le contrat du projet, pas par un second validateur.
 *
 * Ses calques finiront dans un écran ; ce qui décide de ce qu'un écran accepte
 * est `isProject`, et l'enrouler dans un projet minimal coûte un objet
 * littéral. Un validateur écrit à côté aurait divergé du premier au premier
 * champ ajouté, et la divergence aurait pris la forme d'un gabarit enregistré
 * puis refusé à l'application.
 */
export function isCustomTemplate(value: unknown): value is CustomTemplate {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !record.id) return false
  if (typeof record.name !== 'string' || record.name.length > MAX_TEMPLATE_NAME_LENGTH) return false
  if (
    typeof record.description !== 'string' ||
    record.description.length > MAX_TEMPLATE_DESCRIPTION_LENGTH
  ) {
    return false
  }
  if (record.source !== 'ai' && record.source !== 'user') return false
  if (!isAppStoreProfileId(record.profileId)) return false
  if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) return false
  if (!record.assets || typeof record.assets !== 'object' || Array.isArray(record.assets)) {
    return false
  }
  if (!Object.values(record.assets).every((url) => typeof url === 'string' && url.length > 0)) {
    return false
  }

  return isProject({
    id: 'template',
    name: record.name,
    profileId: record.profileId,
    activeScreenId: 'screen',
    globals: DEFAULT_GLOBALS,
    createdAt: record.createdAt,
    updatedAt: record.createdAt,
    layoutLayers: [],
    screens: [
      { id: 'screen', name: record.name, background: record.background, layers: record.layers },
    ],
  })
}

/** L'écran tel qu'il sera rejoué : sans sa capture, avec ses images. */
function keepable(layer: Layer): Layer {
  if (layer.type !== 'device-frame') return structuredClone(layer)
  const copy = structuredClone(layer)
  delete copy.screenshotAssetId
  delete copy.screenshotSize
  delete copy.placement
  return copy
}

export class TemplateRefusedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TemplateRefusedError'
  }
}

/**
 * Fige un écran en gabarit, avec les octets de ses images.
 *
 * Un asset introuvable arrête la sauvegarde plutôt que de laisser tomber le
 * calque : un gabarit amputé d'un logo se découvre à l'application, sur un
 * écran qu'on croyait fidèle.
 */
export function templateFromScreen(
  screen: Screen,
  meta: {
    name: string
    description?: string
    source: CustomTemplate['source']
    profileId?: AppStoreProfileId
  },
): CustomTemplate {
  const layers = screen.layers.map(keepable)
  const ids = new Set<string>()
  for (const layer of layers) collectLayerAssetIds(layer, ids)

  const assets: Record<string, string> = {}
  for (const id of ids) {
    const dataUrl = resolveAsset(id)
    if (!dataUrl) {
      throw new TemplateRefusedError(
        `Image « ${id} » introuvable dans ce projet : le gabarit serait incomplet.`,
      )
    }
    assets[id] = dataUrl
  }

  return {
    id: crypto.randomUUID(),
    name: meta.name,
    profileId: meta.profileId ?? DEFAULT_APP_STORE_PROFILE_ID,
    description: meta.description ?? `D’après « ${screen.name} ».`,
    background: structuredClone(screen.background),
    layers,
    assets,
    source: meta.source,
    createdAt: Date.now(),
  }
}

/**
 * Rend le gabarit applicable ici et maintenant.
 *
 * Les identifiants d'assets sont refaits parce qu'ils appartenaient au projet
 * d'origine : `registerAsset` déduplique par contenu, donc appliquer deux fois
 * le même gabarit ne stocke qu'une copie, et l'appliquer dans le projet qui l'a
 * produit retombe sur l'asset déjà présent.
 */
export function instantiateTemplate(template: CustomTemplate): TemplateDefinition {
  const remapped = new Map<string, string>()
  for (const [id, dataUrl] of Object.entries(template.assets)) {
    remapped.set(id, registerAsset(dataUrl))
  }

  const layers = template.layers.map((layer) => {
    const copy = structuredClone(layer)
    if (copy.type === 'image') copy.assetId = remapped.get(copy.assetId) ?? copy.assetId
    if (copy.type === 'device-frame' && copy.importedBezel) {
      copy.importedBezel.assetId =
        remapped.get(copy.importedBezel.assetId) ?? copy.importedBezel.assetId
    }
    return copy
  })

  return {
    id: template.id,
    name: template.name,
    profileId: template.profileId,
    description: template.description,
    background: structuredClone(template.background),
    layers,
  }
}

/** Un enregistrement illisible est ignoré, jamais fatal : les autres existent. */
export async function readCustomTemplates(): Promise<CustomTemplate[]> {
  const db = await getDB()
  const records = await db.getAll('templates')
  return records
    .map((record) =>
      record && typeof record === 'object' && !('profileId' in record)
        ? { ...record, profileId: DEFAULT_APP_STORE_PROFILE_ID }
        : record,
    )
    .filter(isCustomTemplate)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function writeCustomTemplate(
  template: CustomTemplate,
  signal?: AbortSignal,
): Promise<void> {
  const db = await getDB()
  signal?.throwIfAborted()
  const tx = db.transaction('templates', 'readwrite')
  const abort = () => {
    try {
      tx.abort()
    } catch {
      // La transaction a déjà atteint son commit : l'écriture est acquise.
    }
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    await Promise.all([tx.store.put(template), tx.done])
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

export async function deleteCustomTemplate(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('templates', id)
}
