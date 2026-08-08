/**
 * La synchronisation cloud d'un projet, dans les deux sens.
 *
 * Le modèle est celui décidé au plan : le projet est un document auto-contenu,
 * il part et revient d'un bloc, et le conflit se tranche au dernier écrivain
 * sur `updatedAt`. Aucune fusion fine, aucun temps réel — deux navigateurs
 * ouverts en même temps sur le même projet, c'est le dernier qui a écrit qui
 * gagne, et c'est dit tel quel plutôt que déguisé en résolution automatique.
 *
 * Trois règles tiennent le reste :
 *
 * 1. **Rien ne part qui ne soit déjà sur le disque local.** Le déclencheur est
 *    `onProjectCommitted`, à la sortie de la transaction IndexedDB, pas un
 *    abonnement au store.
 * 2. **Rien n'est jamais bloquant.** Une panne de réseau, une session expirée
 *    ou un bucket indisponible changent une pastille et rien d'autre : l'édition
 *    continue, l'autosave local aussi.
 * 3. **Sans compte, ce module ne s'exécute pas.** `initSync` sort immédiatement
 *    quand l'instance n'est pas configurée, et n'importe alors rien du SDK.
 *
 * La porte commerciale — la sync est l'add-on Cloud, pas un acquis du compte —
 * se pose en phase 5 dans `syncAllowed()` : un seul endroit à resserrer.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { collectAssetIds } from '@/lib/asset-refs'
import { resolveAsset } from '@/lib/assets'
import { projectWithoutThumbnails } from '@/lib/project-file'
import { normalizeProject, adoptRemoteProject, onProjectCommitted } from '@/lib/storage'
import { cloudConfigured, getSupabase } from '@/lib/supabase'
import { readSyncRecord, syncKey, writeSyncRecord } from '@/lib/sync-queue'
import { useAuthStore } from '@/stores/auth.store'
import { useProjectStore } from '@/stores/project.store'
import { toast } from '@/stores/toast.store'
import { useUIStore, type SyncStatus } from '@/stores/ui.store'
import type { Database, Json } from '@/types/database.types'
import type { Project } from '@/types'

const BUCKET = 'assets'

type Client = SupabaseClient<Database>

function setStatus(status: SyncStatus): void {
  useUIStore.getState().setSyncStatus(status)
}

/**
 * Le point unique où se branchera la vente.
 *
 * Aujourd'hui : « il y a une instance et une session ». En phase 5 : « …et le
 * droit `cloud` est actif ». Un utilisateur sans le droit doit retomber
 * exactement sur le comportement d'aujourd'hui — aucune requête, aucun
 * `syncStatus`, jamais une erreur pour une fonction qu'il n'a pas achetée.
 */
function syncAllowed(): boolean {
  return cloudConfigured && useAuthStore.getState().status === 'signed-in'
}

function currentUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null
}

// ─── Binaires ────────────────────────────────────────────────────────────────

/**
 * Le registre garde des data URL, Storage veut des octets. `fetch` sait lire
 * une `data:` URL et rend le blob décodé avec son type — refaire le décodage
 * base64 à la main ici serait la troisième copie du même code dans le dépôt.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the asset.'))
    reader.readAsDataURL(blob)
  })
}

// ─── Push ────────────────────────────────────────────────────────────────────

async function pushProject(client: Client, userId: string, project: Project): Promise<void> {
  const key = syncKey(userId, project.id)
  const record = await readSyncRecord(key)
  if (project.updatedAt <= record.pushedUpdatedAt) return

  const assetIds = [...collectAssetIds(project)]
  const confirmed = new Set(record.uploadedAssetIds.filter((id) => assetIds.includes(id)))
  const missing = assetIds.filter((id) => !confirmed.has(id))

  /* `allSettled` et non `all` : un envoi qui casse au milieu doit laisser
     derrière lui les accusés de réception de ceux qui sont passés, sinon une
     coupure sur la dixième image fait recommencer les neuf premières à chaque
     tentative. */
  const uploads = await Promise.allSettled(
    missing.map(async (id) => {
      const dataUrl = resolveAsset(id)
      /* Un `assetId` référencé mais absent du registre est un projet déjà
         abîmé localement ; le signaler ici en échouant bloquerait la sync du
         reste sans rien réparer. */
      if (!dataUrl) return id
      const blob = await dataUrlToBlob(dataUrl)
      const { error } = await client.storage
        .from(BUCKET)
        .upload(`${userId}/${id}`, blob, { contentType: blob.type, upsert: true })
      if (error) throw error
      return id
    }),
  )
  for (const upload of uploads) {
    if (upload.status === 'fulfilled') confirmed.add(upload.value)
  }

  const failed = uploads.find((upload) => upload.status === 'rejected')
  if (failed) {
    await writeSyncRecord({ ...record, uploadedAssetIds: [...confirmed] })
    throw failed.reason
  }

  /* La ligne part après ses images : l'inverse laisserait une fenêtre où un
     second navigateur tire un projet dont les binaires ne sont pas encore là. */
  const { error } = await client.from('projects').upsert({
    id: project.id,
    user_id: userId,
    name: project.name,
    data: projectWithoutThumbnails(project) as unknown as Json,
    updated_at: new Date(project.updatedAt).toISOString(),
  })
  if (error) throw error

  await writeSyncRecord({
    key,
    pushedUpdatedAt: project.updatedAt,
    uploadedAssetIds: [...confirmed],
  })
}

// ─── Pull ────────────────────────────────────────────────────────────────────

/**
 * Décide s'il y a quelque chose à tirer, et quoi.
 *
 * Deux cas seulement, et le second est celui qui fait la valeur de la fonction.
 *
 * - Le projet ouvert a une ligne distante : on compare les `updatedAt`.
 * - Il n'en a pas, **et il n'a jamais été modifié** (`createdAt === updatedAt`,
 *   la signature d'un « Projet sans titre » que l'application vient de créer
 *   faute d'en trouver un en base) : on adopte le projet distant le plus récent.
 *   C'est le second navigateur, et c'est le seul endroit où l'on remplace un
 *   document par un autre sans que l'utilisateur l'ait demandé — d'où la
 *   condition stricte plutôt qu'une heuristique de fraîcheur.
 */
function pullTarget(
  rows: { id: string; updated_at: string }[],
  local: Project | null,
): string | null {
  if (!rows.length) return null
  const mine = local ? rows.find((row) => row.id === local.id) : undefined
  if (mine) return Date.parse(mine.updated_at) > (local?.updatedAt ?? 0) ? mine.id : null
  if (local && local.createdAt !== local.updatedAt) return null
  return rows[0].id
}

async function pullProject(client: Client, userId: string): Promise<boolean> {
  const { data: rows, error } = await client
    .from('projects')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
  if (error) throw error

  const targetId = pullTarget(rows ?? [], useProjectStore.getState().project)
  if (!targetId) return false

  const { data: row, error: rowError } = await client
    .from('projects')
    .select('data')
    .eq('id', targetId)
    .single()
  if (rowError) throw rowError

  const project = normalizeProject(row.data)
  const assetIds = [...collectAssetIds(project)]
  /* Tout ou rien : un binaire manquant fait échouer le tirage entier plutôt
     que d'installer un projet troué par-dessus celui de l'utilisateur. La
     tentative suivante repartira du même point. */
  const assets = await Promise.all(
    assetIds.map(async (id) => {
      const { data, error: downloadError } = await client.storage
        .from(BUCKET)
        .download(`${userId}/${id}`)
      if (downloadError) throw downloadError
      return { id, dataUrl: await blobToDataUrl(data) }
    }),
  )

  await adoptRemoteProject(project, assets)
  /* Le projet fraîchement installé sera commité par l'autosave, donc notifié :
     sans cet enregistrement il repartirait aussitôt vers le serveur qui vient
     de le fournir. */
  await writeSyncRecord({
    key: syncKey(userId, project.id),
    pushedUpdatedAt: project.updatedAt,
    uploadedAssetIds: assetIds,
  })
  return true
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/** La file d'exécution : un cycle à la fois — voir `schedule`. */
let chain: Promise<void> = Promise.resolve()
/** Le dernier projet commité, en attente d'un cycle. */
let queued: Project | null = null
/** Vrai pendant un tirage : ce qu'il commite localement ne doit pas repartir. */
let pulling = false
/** Le tirage n'a lieu qu'une fois par session ouverte, à l'ouverture. */
let pulled = false

function offline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

async function cycle(): Promise<void> {
  if (!syncAllowed()) return setStatus('off')
  const userId = currentUserId()
  const pending = getSupabase()
  if (!userId || !pending) return setStatus('off')
  if (offline()) return setStatus('offline')

  setStatus('syncing')
  const client = await pending

  if (!pulled) {
    pulling = true
    try {
      if (await pullProject(client, userId)) toast('Version cloud chargée.', 'info')
    } finally {
      pulling = false
      /* Le projet que le tirage vient d'installer sera commité par l'autosave ;
         ce n'est pas une modification de l'utilisateur, elle n'a rien à renvoyer. */
      queued = null
    }
    pulled = true
  }

  const project = queued ?? useProjectStore.getState().project
  queued = null
  if (project) await pushProject(client, userId, project)
  setStatus('synced')
}

function fail(error: unknown): void {
  console.error('Cloud sync failed.', error)
  if (offline()) return setStatus('offline')
  setStatus('error')
  toast('Synchronisation impossible. Vos modifications restent enregistrées ici.', 'error', {
    action: { label: 'Réessayer', onClick: schedule },
  })
}

/**
 * Un cycle à la fois, en file.
 *
 * Deux `upsert` concurrents sur la même ligne peuvent arriver dans le désordre
 * et laisser le serveur sur la version la plus ancienne. La chaîne l'interdit,
 * et l'autosave qui la nourrit ne commite au plus qu'une fois toutes les deux
 * secondes — il n'y a donc pas de second minuteur à écrire pour borner le débit.
 */
function schedule(): void {
  if (!syncAllowed()) return setStatus('off')
  chain = chain.then(cycle).catch(fail)
}

/**
 * Branche la sync, et rend son démonteur.
 *
 * Sans instance configurée, rien ne s'abonne et le SDK n'est pas chargé : la
 * couche cloud est additive, elle ne doit pas peser sur ce à quoi elle
 * n'ajoute rien.
 */
export function initSync(): () => void {
  if (!cloudConfigured) return () => {}

  const stopCommits = onProjectCommitted((project) => {
    if (pulling || !syncAllowed()) return
    queued = project
    schedule()
  })

  const stopAuth = useAuthStore.subscribe((state, previous) => {
    if (state.status === previous.status) return
    if (state.status === 'signed-in') {
      /* Une nouvelle session repart d'un tirage : c'est le moment exact où
         « ouvrir l'app connecté » et « se connecter » deviennent le même geste. */
      pulled = false
      schedule()
      return
    }
    if (state.status === 'signed-out') {
      pulled = false
      queued = null
      setStatus('off')
    }
  })

  const onOnline = () => schedule()
  const onOffline = () => {
    if (syncAllowed()) setStatus('offline')
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  /* Le cas « la session était déjà restaurée avant cet abonnement » : sans ce
     coup d'envoi, un rechargement de page connecté ne tirerait jamais. */
  if (syncAllowed()) schedule()

  return () => {
    stopCommits()
    stopAuth()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
