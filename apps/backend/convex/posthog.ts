import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'

const EU_MANAGEMENT_HOST = 'https://eu.posthog.com'

export type PosthogDeletionOutcome =
  | 'deleted'
  | 'absent'
  | 'configuration'
  | 'invalid-response'
  | 'network'
  | 'rate-limited'
  | 'service-unavailable'
  | 'unauthorized'

interface PosthogConfiguration {
  POSTHOG_HOST?: string
  POSTHOG_PERSON_API_KEY?: string
  POSTHOG_PROJECT_ID?: string
}

function failure(status: number): Exclude<PosthogDeletionOutcome, 'deleted' | 'absent'> {
  if (status === 401 || status === 403) return 'unauthorized'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'service-unavailable'
  return 'invalid-response'
}

function idsFrom(value: unknown, distinctId: string): string[] | null {
  if (!value || typeof value !== 'object' || !('results' in value)) return null
  if (!Array.isArray(value.results)) return null

  const ids: string[] = []
  for (const person of value.results) {
    if (!person || typeof person !== 'object') return null
    if (!('distinct_ids' in person) || !Array.isArray(person.distinct_ids)) return null
    if (!person.distinct_ids.every((id: unknown) => typeof id === 'string')) return null
    if (!person.distinct_ids.includes(distinctId)) continue
    const id =
      'uuid' in person && typeof person.uuid === 'string'
        ? person.uuid
        : 'id' in person && typeof person.id === 'string'
          ? person.id
          : ''
    if (!id) return null
    ids.push(id)
  }
  return [...new Set(ids)]
}

/** Delete every exact person match; no email or response body reaches logs. */
export async function deletePosthogPerson(
  distinctId: string,
  configuration: PosthogConfiguration,
  request: typeof fetch = fetch,
): Promise<PosthogDeletionOutcome> {
  const host = configuration.POSTHOG_HOST?.trim()
  const projectId = configuration.POSTHOG_PROJECT_ID?.trim()
  const key = configuration.POSTHOG_PERSON_API_KEY?.trim()
  if (host !== EU_MANAGEMENT_HOST || !projectId || !/^\d+$/.test(projectId) || !key) {
    return 'configuration'
  }

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const persons = new URL(`/api/projects/${projectId}/persons/`, host)
  persons.searchParams.set('search', distinctId)
  persons.searchParams.set('limit', '100')

  try {
    const found = await request(persons, { headers, signal: AbortSignal.timeout(10_000) })
    if (!found.ok) return failure(found.status)
    const ids = idsFrom(await found.json(), distinctId)
    if (ids === null) return 'invalid-response'
    if (ids.length === 0) return 'absent'

    const deleted = await request(
      new URL(`/api/projects/${projectId}/persons/bulk_delete/`, host),
      {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({
          ids,
          delete_events: true,
          delete_recordings: true,
          keep_person: false,
        }),
      },
    )
    return deleted.status === 202 ? 'deleted' : failure(deleted.status)
  } catch {
    return 'network'
  }
}

const outcome = v.union(
  v.literal('deleted'),
  v.literal('absent'),
  v.literal('configuration'),
  v.literal('invalid-response'),
  v.literal('network'),
  v.literal('rate-limited'),
  v.literal('service-unavailable'),
  v.literal('unauthorized'),
)

export const deletePerson = internalAction({
  args: { userId: v.string() },
  returns: outcome,
  handler: async (ctx, { userId }): Promise<PosthogDeletionOutcome> => {
    const result = await deletePosthogPerson(userId, env)
    await ctx.runMutation(internal.accountDeletion.finishTelemetry, { userId, outcome: result })
    return result
  },
})
