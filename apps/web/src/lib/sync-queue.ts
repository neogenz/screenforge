/**
 * Ce que le cloud doit encore recevoir, écrit sur le disque.
 *
 * C'est la file hors-ligne de la phase 3, et ce n'est délibérément pas un
 * journal de mutations. Un projet ScreenForge se synchronise d'un bloc, en
 * dernier-écrivain-gagne sur `updatedAt` : rejouer une suite de mutations
 * périmées par-dessus ce modèle ne reconstruirait rien de cohérent, et le
 * document complet est déjà persisté par l'autosave. La seule chose qui manque
 * pour survivre à un rechargement hors-ligne est donc de savoir *jusqu'où* le
 * serveur a été mis à jour. Deux nombres et une liste suffisent à le dire.
 *
 * Base séparée de `screenforge` : ce fichier n'a aucune raison de faire monter
 * la version du schéma qui porte les projets de l'utilisateur, et une migration
 * ratée là-bas coûterait son travail, pas un état de synchronisation qui se
 * reconstruit tout seul.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface SyncRecord {
  /** `{userId}:{projectId}` — voir `syncKey`. */
  key: string
  /** `updatedAt` du projet dont le serveur a accusé réception. */
  pushedUpdatedAt: number
  /** Les `assetId` dont le dépôt dans Storage a été confirmé. */
  uploadedAssetIds: string[]
}

interface SyncDB extends DBSchema {
  pending: { key: string; value: SyncRecord }
}

let dbPromise: Promise<IDBPDatabase<SyncDB>> | null = null

function getDB(): Promise<IDBPDatabase<SyncDB>> {
  dbPromise ??= openDB<SyncDB>('screenforge-sync', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'key' })
      }
    },
    blocking() {
      void dbPromise?.then((db) => db.close())
      dbPromise = null
    },
  })
  return dbPromise
}

/**
 * La clé porte l'utilisateur, pas seulement le projet.
 *
 * Le chemin d'un objet dans Storage est `{user_id}/{asset_id}` : « déjà
 * envoyé » est donc une affirmation sur un dossier, pas sur un fichier. Sans
 * l'identité dans la clé, une seconde session sur le même navigateur hériterait
 * des accusés de réception de la première et ne téléverserait jamais ses
 * propres copies — le projet arriverait dans le cloud avec des images qu'aucune
 * policy ne lui laisserait relire.
 */
export function syncKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`
}

const EMPTY: Omit<SyncRecord, 'key'> = { pushedUpdatedAt: 0, uploadedAssetIds: [] }

/** L'absence d'enregistrement se lit « rien n'est parti », jamais une erreur. */
export async function readSyncRecord(key: string): Promise<SyncRecord> {
  try {
    const db = await getDB()
    return (await db.get('pending', key)) ?? { key, ...EMPTY }
  } catch (error) {
    console.warn('Could not read the sync record.', error)
    return { key, ...EMPTY }
  }
}

export async function writeSyncRecord(record: SyncRecord): Promise<void> {
  const db = await getDB()
  await db.put('pending', record)
}
