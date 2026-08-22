import { describe, expect, it, vi } from 'vitest'
import { deletePosthogPerson } from './posthog'

const configuration = {
  POSTHOG_HOST: 'https://eu.posthog.com',
  POSTHOG_PERSON_API_KEY: 'test-person-key',
  POSTHOG_PROJECT_ID: '123456',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('suppression de personne PostHog', () => {
  it('supprime uniquement les correspondances exactes avec événements et replays', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json({
          results: [
            { uuid: 'near-match', distinct_ids: ['user-10'] },
            { id: 'exact-match', distinct_ids: ['user-1', 'legacy-id'] },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))

    await expect(deletePosthogPerson('user-1', configuration, request)).resolves.toBe('deleted')
    expect(request).toHaveBeenCalledTimes(2)

    const [lookup, lookupInit] = request.mock.calls[0]!
    expect(String(lookup)).toBe(
      'https://eu.posthog.com/api/projects/123456/persons/?search=user-1&limit=100',
    )
    expect(new Headers(lookupInit?.headers).get('Authorization')).toBe('Bearer test-person-key')

    const [deletion, deletionInit] = request.mock.calls[1]!
    expect(String(deletion)).toBe('https://eu.posthog.com/api/projects/123456/persons/bulk_delete/')
    expect(JSON.parse(String(deletionInit?.body))).toEqual({
      ids: ['exact-match'],
      delete_events: true,
      delete_recordings: true,
      keep_person: false,
    })
  })

  it('considère une personne absente comme déjà supprimée', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ results: [] }))

    await expect(deletePosthogPerson('missing', configuration, request)).resolves.toBe('absent')
    expect(request).toHaveBeenCalledOnce()
  })

  it.each([
    [429, 'rate-limited'],
    [503, 'service-unavailable'],
  ] as const)('garde une erreur HTTP %s sous forme non sensible', async (status, outcome) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }))
    await expect(deletePosthogPerson('user-1', configuration, request)).resolves.toBe(outcome)
  })

  it('refuse une réponse ambiguë au lieu de conclure à une absence', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({ results: [{}] }))
    await expect(deletePosthogPerson('user-1', configuration, request)).resolves.toBe(
      'invalid-response',
    )
  })

  it('refuse tout autre hôte et tout identifiant de projet non numérique', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(
      deletePosthogPerson(
        'user-1',
        { ...configuration, POSTHOG_HOST: 'https://posthog.com' },
        request,
      ),
    ).resolves.toBe('configuration')
    await expect(
      deletePosthogPerson('user-1', { ...configuration, POSTHOG_PROJECT_ID: '../other' }, request),
    ).resolves.toBe('configuration')
    expect(request).not.toHaveBeenCalled()
  })
})
