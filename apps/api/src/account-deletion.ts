import { serviceClient } from './supabase.ts'

const TABLE = 'account_deletion_jobs'
const BUCKET = 'assets'
const PAGE_SIZE = 100
const WORKER_INTERVAL_MS = 60_000

interface DeletionJob {
  user_id: string
  status: 'prepared' | 'cleanup'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function recordFailure(userId: string, error: unknown): Promise<void> {
  const client = serviceClient()
  const { data } = await client.from(TABLE).select('attempts').eq('user_id', userId).maybeSingle()
  await client
    .from(TABLE)
    .update({
      attempts: Number(data?.attempts ?? 0) + 1,
      last_error: errorMessage(error),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
}

/** Persist the upload fence before any irreversible operation. */
export async function prepareAccountDeletion(userId: string): Promise<boolean> {
  const { error } = await serviceClient().from(TABLE).upsert({
    user_id: userId,
    status: 'prepared',
    attempts: 0,
    last_error: null,
    updated_at: new Date().toISOString(),
  })
  return !error
}

/** Roll back the fence when Auth refused to delete the identity. */
export async function cancelAccountDeletion(userId: string): Promise<boolean> {
  const { error } = await serviceClient().from(TABLE).delete().eq('user_id', userId)
  return !error
}

/** Best-effort phase marker; the worker can also prove deletion through Auth. */
export async function markAccountDeleted(userId: string): Promise<void> {
  const { error } = await serviceClient()
    .from(TABLE)
    .update({ status: 'cleanup', last_error: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
  if (error) console.error('Could not mark account deletion ready for cleanup.', { userId, error })
}

/**
 * Empty one durable Storage folder, always relisting offset zero.
 *
 * Uploads are fenced by RLS while the queue row exists. Removing a page shifts
 * the next page to offset zero, so advancing an offset would skip objects.
 */
export async function cleanupAccountDeletion(userId: string): Promise<boolean> {
  const client = serviceClient()
  try {
    for (;;) {
      const { data, error } = await client.storage
        .from(BUCKET)
        .list(userId, { limit: PAGE_SIZE, offset: 0 })
      if (error) throw error
      if (data.length === 0) break

      const { error: removeError } = await client.storage
        .from(BUCKET)
        .remove(data.map((object) => `${userId}/${object.name}`))
      if (removeError) throw removeError
    }

    const { error: finishError } = await client.from(TABLE).delete().eq('user_id', userId)
    if (finishError) throw finishError
    return true
  } catch (error) {
    await recordFailure(userId, error)
    console.error('Account deletion cleanup remains queued.', { userId, error })
    return false
  }
}

function missingUser(error: unknown, user: unknown): boolean {
  if (user) return false
  if (!error) return true
  if (typeof error === 'object' && error && 'status' in error && error.status === 404) return true
  return errorMessage(error).toLowerCase().includes('not found')
}

/** Resume every deletion that is known to be past identity removal. */
export async function resumeAccountDeletionJobs(): Promise<void> {
  const client = serviceClient()
  const { data, error } = await client
    .from(TABLE)
    .select('user_id, status')
    .order('created_at', { ascending: true })
  if (error) throw error

  for (const job of (data ?? []) as DeletionJob[]) {
    if (job.status === 'prepared') {
      const { data: identity, error: identityError } = await client.auth.admin.getUserById(
        job.user_id,
      )
      if (!missingUser(identityError, identity.user)) {
        if (identityError) await recordFailure(job.user_id, identityError)
        continue
      }
    }
    await cleanupAccountDeletion(job.user_id)
  }
}

/** Railway process worker: one boot pass, then a non-overlapping minute tick. */
export function startAccountDeletionWorker(intervalMs = WORKER_INTERVAL_MS): () => void {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      await resumeAccountDeletionJobs()
    } catch (error) {
      console.error('Could not resume account deletion jobs.', error)
    } finally {
      running = false
    }
  }

  void run()
  const timer = setInterval(() => void run(), intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
