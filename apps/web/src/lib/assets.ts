/**
 * Binary asset registry.
 *
 * Image payloads (image layers, device screenshots) live OUTSIDE the layer
 * graph: layers hold a short `assetId`, the data URL lives here. History
 * snapshots, autosave serialization and canvas sync diffs stay tiny as a
 * result — this is the root fix for the editor's per-keystroke churn.
 *
 * In-memory Map is the hot path; IndexedDB persistence is handled by
 * lib/storage.ts (assets object store, flushed with project saves).
 */

const registry = new Map<string, string>()
/** length → ids, for cheap dedupe (full string compare only within a bucket). */
const idsByLength = new Map<number, Set<string>>()
const dirtyIds = new Set<string>()

/** Registers a data URL and returns its asset id. Dedupes identical payloads. */
export function registerAsset(dataUrl: string): string {
  const bucket = idsByLength.get(dataUrl.length)
  if (bucket) {
    for (const id of bucket) {
      if (registry.get(id) === dataUrl) return id
    }
  }
  const id = crypto.randomUUID()
  registry.set(id, dataUrl)
  if (bucket) bucket.add(id)
  else idsByLength.set(dataUrl.length, new Set([id]))
  dirtyIds.add(id)
  return id
}

export function resolveAsset(id: string | undefined): string | undefined {
  return id ? registry.get(id) : undefined
}

/** Replaces the registry contents (called when a project is loaded). */
export function hydrateAssets(records: readonly { id: string; dataUrl: string }[]): void {
  registry.clear()
  idsByLength.clear()
  dirtyIds.clear()
  for (const record of records) {
    registry.set(record.id, record.dataUrl)
    const bucket = idsByLength.get(record.dataUrl.length)
    if (bucket) bucket.add(record.id)
    else idsByLength.set(record.dataUrl.length, new Set([record.id]))
  }
}

export function clearAssets(): void {
  registry.clear()
  idsByLength.clear()
  dirtyIds.clear()
}

/** Returns registered-but-unpersisted assets without changing retry state. */
export function readDirtyAssets(): { id: string; dataUrl: string }[] {
  const dirty: { id: string; dataUrl: string }[] = []
  for (const id of dirtyIds) {
    const dataUrl = registry.get(id)
    if (dataUrl) dirty.push({ id, dataUrl })
  }
  return dirty
}

/** Marks only assets confirmed by an IndexedDB commit as clean. */
export function markAssetsClean(ids: Iterable<string>): void {
  for (const id of ids) dirtyIds.delete(id)
}

function drop(id: string, dataUrl: string): void {
  registry.delete(id)
  dirtyIds.delete(id)
  const bucket = idsByLength.get(dataUrl.length)
  bucket?.delete(id)
  if (bucket?.size === 0) idsByLength.delete(dataUrl.length)
}

/** Removes unreferenced payloads from every in-memory registry index. */
export function sweepAssets(keepIds: ReadonlySet<string>): string[] {
  const removed: string[] = []
  for (const [id, dataUrl] of registry) {
    if (keepIds.has(id)) continue
    drop(id, dataUrl)
    removed.push(id)
  }
  return removed
}

/**
 * Oublie des assets enregistrés puis abandonnés, sans toucher au reste.
 *
 * Le balayage général n'est correct qu'au chargement, quand la pile
 * d'annulation vient d'être vidée : ailleurs, il effacerait ce qu'une capture
 * d'historique référence encore. Ici l'appelant nomme les identifiants qu'il
 * vient lui-même de créer et que rien n'a encore pu voir, et `keepIds` protège
 * le cas où la déduplication lui a rendu l'identifiant d'un asset déjà posé.
 */
export function forgetAssets(ids: Iterable<string>, keepIds: ReadonlySet<string>): string[] {
  const removed: string[] = []
  for (const id of ids) {
    const dataUrl = registry.get(id)
    if (dataUrl === undefined || keepIds.has(id)) continue
    drop(id, dataUrl)
    removed.push(id)
  }
  return removed
}
