import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { aiProvider, type ProviderId } from '@/lib/ai/providers'

/**
 * L'appairage qui survit à la fermeture de l'onglet, et ce que ça protège.
 *
 * Le contrat précédent — « une clé est une session » — tenait tant qu'il n'y
 * avait qu'un jeton de pont à retenir : ce jeton est tiré au démarrage du pont
 * et meurt avec son processus, donc le persister l'aurait rendu faux au premier
 * redémarrage. Une clé d'API, elle, vit des mois. Faire recoller une clé
 * Anthropic à chaque rechargement de page n'est pas une mesure de sécurité,
 * c'est une taxe : la clé finit dans un fichier texte à côté, ou dans le
 * presse-papier en permanence, ce qui est strictement pire que ce qui suit.
 *
 * **Le secret est scellé, jamais posé en clair.** Il est chiffré en AES-GCM par
 * une clé que le navigateur génère lui-même en `extractable: false`. Cette
 * clé-là est rangée dans le même IndexedDB, mais elle n'a pas de valeur
 * lisible : la seule chose qu'un script ou un lecteur de fichier en obtienne
 * est une poignée opaque. `crypto.subtle` accepte de s'en servir, personne
 * n'accepte de la rendre.
 *
 * **Ce que ça arrête** : quiconque lit les fichiers du profil du navigateur —
 * une sauvegarde Time Machine, un dossier synchronisé, un autre compte de la
 * machine, un disque récupéré. Le chiffré ne dit rien sans la clé, et la clé ne
 * sort pas du magasin du navigateur.
 *
 * **Ce que ça n'arrête pas, et qu'aucun stockage de navigateur n'arrête** : un
 * script exécuté sur cette origine — une injection, une extension ayant accès à
 * la page. Il n'a pas besoin de lire la clé, il lui suffit d'appeler
 * `decrypt()`. Il n'existe pas de coffre-fort dans un onglet ; il existe un
 * chiffrement au repos, et c'est ce qui est fait ici.
 *
 * **Ce qui n'est jamais persisté** : le jeton d'appairage du pont, périmé
 * d'avance ; l'état de connexion et le catalogue de modèles, qui sont le
 * résultat d'une requête et non un réglage. Rouvrir la boîte propose donc la
 * clé et le modèle, et laisse le clic de connexion à l'utilisateur — une
 * requête sortante au seul fait d'ouvrir une fenêtre serait une surprise.
 *
 * La base est distincte de `screenforge` **par construction** : rien de ce qui
 * est ici ne peut partir dans un export de projet, une synchronisation Cloud ou
 * un fichier partagé, puisque ces chemins-là ne lisent que la base des projets.
 */

const DB_NAME = 'screenforge-keys'
const STORE = 'vault'
/** Un seul enregistrement : lu et réécrit d'un bloc, donc jamais mi-cohérent. */
const RECORD = 'assistant'

interface Sealed {
  /* `Uint8Array<ArrayBuffer>` et non `Uint8Array` : le second admet un
     `SharedArrayBuffer`, que `crypto.subtle` refuse. Rien n'en produit ici, mais
     c'est au relu du disque que le type se perd. */
  iv: Uint8Array<ArrayBuffer>
  data: ArrayBuffer
}

interface Vault {
  /** Non extractible : structuré-clonable, mais sans valeur lisible. */
  wrap?: CryptoKey
  pairing?: { providerId: ProviderId; model: string }
  /** Un scellé par fournisseur : changer de service ne perd pas l'autre clé. */
  secrets?: Record<string, Sealed>
}

interface VaultDB extends DBSchema {
  vault: { key: string; value: Vault }
}

/** Le secret d'un fournisseur ne survit que s'il vaut encore demain. */
function durable(providerId: ProviderId): boolean {
  return aiProvider(providerId).auth === 'api-key'
}

/**
 * `crypto.subtle` n'existe qu'en contexte sécurisé.
 *
 * `localhost` en est un, `https` aussi ; une page servie en `http` sur une IP de
 * réseau local n'en est pas un. Là, on ne persiste rien plutôt que de retomber
 * sur un stockage en clair : un secret écrit lisible serait pire que la saisie
 * qu'il évite, et l'utilisateur croirait la même chose des deux.
 */
function sealingAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && Boolean(globalThis.crypto?.subtle)
}

let dbPromise: Promise<IDBPDatabase<VaultDB>> | null = null

function getDB(): Promise<IDBPDatabase<VaultDB>> {
  dbPromise ??= openDB<VaultDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE)
    },
  })
  return dbPromise
}

async function readVault(): Promise<Vault> {
  return (await (await getDB()).get(STORE, RECORD)) ?? {}
}

async function writeVault(vault: Vault): Promise<void> {
  await (await getDB()).put(STORE, vault, RECORD)
}

/**
 * La clé de scellement, générée une fois et mémorisée pour l'onglet.
 *
 * La promesse est mémorisée et non la clé : deux appels concurrents en
 * généreraient deux, et la seconde écraserait la première en laissant le
 * chiffré précédent indéchiffrable.
 */
let wrapPromise: Promise<CryptoKey> | null = null

async function makeWrapKey(): Promise<CryptoKey> {
  const vault = await readVault()
  if (vault.wrap) return vault.wrap
  const wrap = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  await writeVault({ ...vault, wrap })
  return wrap
}

function wrapKey(): Promise<CryptoKey> {
  wrapPromise ??= makeWrapKey()
  return wrapPromise
}

async function seal(plain: string): Promise<Sealed> {
  /* 12 octets, la taille que GCM attend ; tiré à chaque scellement, sans quoi
     deux clés successives se chiffreraient de façon comparable. */
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await wrapKey(),
    new TextEncoder().encode(plain),
  )
  return { iv, data }
}

async function unseal(sealed: Sealed): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv },
    await wrapKey(),
    sealed.data,
  )
  return new TextDecoder().decode(plain)
}

export interface StoredAssistant {
  providerId: ProviderId
  model: string
  secret: string
}

/**
 * Écrit ce qui mérite de survivre, et efface le reste.
 *
 * Un secret vide n'est pas un non-événement : c'est le champ qu'on vient de
 * vider, donc l'enregistrement est supprimé. Sans ça, « oublier » n'aurait
 * aucun chemin.
 */
export async function rememberOnDisk(state: StoredAssistant): Promise<void> {
  if (!sealingAvailable()) return
  try {
    const secret = durable(state.providerId) ? state.secret.trim() : ''
    /* Scellé **avant** de relire le coffre, et l'ordre n'est pas cosmétique :
       au tout premier enregistrement, `seal` fait générer la clé de scellement
       et l'écrit dans ce même enregistrement. Lire d'abord, ce serait réécrire
       ensuite une version d'où elle est absente — la session en garderait une
       copie en mémoire, tout aurait l'air de marcher, et le rechargement
       suivant retrouverait un chiffré que plus rien ne peut ouvrir. */
    const sealed = secret ? await seal(secret) : null
    const vault = await readVault()
    const secrets = { ...vault.secrets }
    if (sealed) secrets[state.providerId] = sealed
    else delete secrets[state.providerId]
    await writeVault({
      ...vault,
      pairing: { providerId: state.providerId, model: state.model },
      secrets,
    })
  } catch {
    /* Un quota plein ou un mode privé refusant l'écriture ne doit pas empêcher
       de générer : la persistance est un confort, la génération est la
       fonction. L'utilisateur le constatera à la prochaine ouverture. */
  }
}

/**
 * Rend l'appairage retenu, ou rien.
 *
 * Un déchiffrement qui échoue — clé de scellement remplacée par un autre onglet,
 * enregistrement corrompu — est traité comme une absence : on redemande le
 * secret, ce qui est toujours possible, plutôt que de faire lire une erreur sur
 * un détail que personne ne peut corriger.
 */
export async function recallFromDisk(): Promise<StoredAssistant | null> {
  if (!sealingAvailable()) return null
  try {
    const vault = await readVault()
    if (!vault.pairing) return null
    /* Le fournisseur vient du disque : `aiProvider` retombe sur le premier si
       l'identifiant n'existe plus, donc un renommage ne rend pas la boîte
       inerte. */
    const providerId = aiProvider(vault.pairing.providerId).id
    const sealed = durable(providerId) ? vault.secrets?.[providerId] : undefined
    return {
      providerId,
      model: typeof vault.pairing.model === 'string' ? vault.pairing.model : '',
      secret: sealed ? await unseal(sealed).catch(() => '') : '',
    }
  } catch {
    return null
  }
}

/**
 * Efface le secret d'un seul fournisseur — le geste « oublier cette clé ».
 *
 * D'un seul, et pas de tous : quelqu'un qui a branché Anthropic puis OpenRouter
 * et retire l'un des deux ne demande pas à ressaisir l'autre. Le fournisseur et
 * le modèle retenus restent aussi : ce sont des préférences, pas des secrets, et
 * les perdre renverrait la boîte à son premier écran pour rien.
 */
export async function forgetStoredSecret(providerId: ProviderId): Promise<void> {
  if (!sealingAvailable()) return
  try {
    const vault = await readVault()
    if (!vault.secrets?.[providerId]) return
    const secrets = { ...vault.secrets }
    delete secrets[providerId]
    await writeVault({ ...vault, secrets })
  } catch {
    /* Voir `rememberOnDisk` : la persistance ne bloque jamais l'usage. */
  }
}

/**
 * Efface tout, clé de scellement comprise : la remise à zéro complète.
 *
 * La clé de scellement part avec le reste, y compris celle gardée en mémoire :
 * la garder resceller-ait avec une clé que le disque ne porte plus, et le
 * prochain rechargement retrouverait un chiffré indéchiffrable.
 */
export async function forgetOnDisk(): Promise<void> {
  wrapPromise = null
  if (typeof indexedDB === 'undefined') return
  try {
    await (await getDB()).delete(STORE, RECORD)
  } catch {
    /* Rien à faire de plus : le secret reste chiffré, et le prochain
       enregistrement l'écrasera. */
  }
}
