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
 * 3. **Sans compte ni droit `cloud`, ce module ne s'exécute pas.** `initSync`
 *    sort immédiatement quand l'instance n'est pas configurée, et n'importe
 *    alors rien du SDK.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { collectAssetIds } from '@/lib/asset-refs'
import { resolveAsset } from '@/lib/assets'
import { rightsOf } from '@/lib/entitlements'
import { projectWithoutThumbnails } from '@/lib/project-file'
import {
  normalizeProject,
  adoptRemoteProject,
  listProjects,
  loadProject,
  onProjectCommitted,
} from '@/lib/storage'
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
 * Le point unique où la vente se branche.
 *
 * Une instance, une session, et le droit `cloud` — dans cet ordre. Un compte
 * Licence est un compte local, pas un compte cloud en erreur : sans le droit,
 * aucune requête ne part et aucun `syncStatus` ne s'affiche. La base refuserait
 * l'écriture de toute façon (`public.has_cloud()` garde les policies), mais lui
 * laisser dire non produirait une pastille rouge et un toast d'échec pour une
 * fonction que l'utilisateur n'a simplement pas achetée.
 *
 * `entitlements` à `null` — droits pas encore lus, ou pas d'instance — vaut
 * non : on ne tente rien tant qu'on ne sait pas. L'abonnement au store rallume
 * la sync dès que la réponse arrive.
 */
function syncAllowed(state = useAuthStore.getState()): boolean {
  return cloudConfigured && state.status === 'signed-in' && rightsOf(state.entitlements).sync
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

// ─── Rattachement des projets locaux ─────────────────────────────────────────

export interface LocalProject {
  id: string
  name: string
  updatedAt: number
}

/**
 * Les projets de ce navigateur que le compte courant n'a jamais envoyés.
 *
 * Le cycle ordinaire ne pousse que le projet ouvert : c'est ce qu'il faut pour
 * une session de travail, et c'est insuffisant au premier login. Quelqu'un qui
 * a construit cinq projets avant d'acheter le Cloud n'en verrait remonter qu'un,
 * et rien ne le lui dirait.
 *
 * « Jamais envoyé » se lit dans la file de synchronisation, pas dans la base
 * distante : `pushedUpdatedAt` à zéro pour cette paire compte/projet. Interroger
 * le serveur donnerait la même réponse au prix d'un aller-retour, et se
 * tromperait sur un projet poussé depuis un autre navigateur — qui n'a alors
 * rien à rattacher ici non plus.
 */
export async function unattachedProjects(): Promise<LocalProject[]> {
  const userId = currentUserId()
  if (!userId || !syncAllowed()) return []
  const local = await listProjects()
  const records = await Promise.all(
    local.map((project) => readSyncRecord(syncKey(userId, project.id))),
  )
  return local.flatMap((project, index) =>
    records[index].pushedUpdatedAt === 0 && touched(project)
      ? [{ id: project.id, name: project.name, updatedAt: project.updatedAt }]
      : [],
  )
}

/**
 * A été ouvert par quelqu'un, pas seulement créé par l'application.
 *
 * `createdAt === updatedAt` est la signature du « Projet sans titre » que
 * l'éditeur ouvre au démarrage faute d'en trouver un en base — la même que
 * `pullTarget` utilise pour décider qu'il peut le remplacer. Sans ce filtre, un
 * premier login proposerait de rattacher le document vide que l'application
 * venait elle-même de fabriquer, et il le proposerait à chaque session.
 */
function touched(project: { createdAt: number; updatedAt: number }): boolean {
  return project.createdAt !== project.updatedAt
}

/**
 * Envoie les projets demandés, et rend ceux qui ont échoué.
 *
 * Dans la file plutôt qu'à côté : deux `upsert` concurrents sur la même ligne
 * peuvent arriver dans le désordre, et le projet ouvert est presque toujours
 * dans la liste à rattacher. Un échec par projet ne fait pas tomber les autres —
 * une seule image manquante ne doit pas retenir quatre projets sains.
 */
export async function attachProjects(ids: string[]): Promise<string[]> {
  const failed: string[] = []
  const run = async () => {
    const userId = currentUserId()
    const pending = getSupabase()
    if (!userId || !pending || !syncAllowed()) {
      failed.push(...ids)
      return
    }
    const client = await pending
    setStatus('syncing')
    for (const id of ids) {
      try {
        const project = await loadProject(id)
        if (!project) continue
        await pushProject(client, userId, project)
      } catch (error) {
        console.error('Could not attach a local project.', error)
        failed.push(id)
      }
    }
    setStatus(failed.length === ids.length ? 'error' : 'synced')
  }

  chain = chain.then(run)
  await chain
  return failed
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

  /* On suit le droit, pas le statut : les droits arrivent une requête après la
     session, donc au moment où `signed-in` est posé la réponse est encore
     `null`. Guetter le seul changement de statut laisserait la sync éteinte
     jusqu'à la modification suivante — et un achat du Cloud en cours de session
     ne l'allumerait jamais. */
  let allowed = syncAllowed()
  const stopAuth = useAuthStore.subscribe((state) => {
    const next = syncAllowed(state)
    if (next === allowed) return
    allowed = next
    if (next) {
      /* Un droit qui s'ouvre repart d'un tirage : c'est le moment exact où
         « ouvrir l'app connecté » et « se connecter » deviennent le même geste. */
      pulled = false
      schedule()
      return
    }
    pulled = false
    queued = null
    setStatus('off')
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
  const stopPrompt = promptForUnattachedProjects()

  return () => {
    stopCommits()
    stopAuth()
    stopPrompt()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}

/**
 * Propose le rattachement quand une session cloud trouve des projets orphelins.
 *
 * Le premier tirage passe avant : il peut installer un projet distant, et
 * demander de rattacher pendant qu'on télécharge afficherait une liste qui
 * change sous les yeux. On attend donc que le premier cycle soit retombé sur
 * `synced`.
 *
 * Une seule fois par session ouverte : la boîte reparaît au login suivant, pas
 * à chaque reconnexion réseau.
 */
function promptForUnattachedProjects(): () => void {
  let asked = false

  const consider = () => {
    if (asked || useUIStore.getState().syncStatus !== 'synced') return
    asked = true
    void unattachedProjects().then((projects) => {
      if (projects.length > 0) useUIStore.getState().setShowMigrateDialog(true)
    })
  }

  consider()
  return useUIStore.subscribe((state, previous) => {
    if (state.syncStatus === previous.syncStatus) return
    /* Une déconnexion réarme : le compte suivant a ses propres orphelins. */
    if (state.syncStatus === 'off') asked = false
    else consider()
  })
}
