import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La suppression de compte, et l'ordre dans lequel elle efface.
 *
 * Les chemins binaires sont capturés avant l'identité, mais leur suppression ne
 * commence qu'après elle. Ainsi un échec Auth ne détruit rien ; un échec
 * Storage tardif décrit honnêtement un nettoyage en attente et laisse une trace
 * opérable avec l'identifiant du dossier.
 */
const supabase = vi.hoisted(() => {
  const calls: string[] = []
  const removedPaths: string[] = []
  const fail = { listOffset: null as number | null, remove: false, deleteUser: false }
  const objects = [{ name: 'a1' }, { name: 'a2' }]
  const client = {
    storage: {
      from: () => ({
        list: async (_path: string, options: { limit: number; offset: number }) => {
          calls.push(`list:${options.offset}`)
          return fail.listOffset === options.offset
            ? { data: null, error: new Error('storage down') }
            : {
                data: objects.slice(options.offset, options.offset + options.limit),
                error: null,
              }
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${paths.join(',')}`)
          if (!fail.remove) removedPaths.push(...paths)
          return { error: fail.remove ? new Error('storage down') : null }
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async () => {
          calls.push('deleteUser')
          return { error: fail.deleteUser ? new Error('auth down') : null }
        },
      },
    },
  }
  return { calls, removedPaths, fail, objects, client }
})

const auth = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  user: null as { id: string; email: string | null } | null,
}))

const USER = auth.userId

vi.mock('../supabase.ts', () => ({
  serviceClient: () => supabase.client,
  verifyToken: async () => auth.user,
}))

process.env.SUPABASE_URL = 'http://127.0.0.1:54421'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-not-used-here'
process.env.POLAR_ACCESS_TOKEN = 'polar_at_test'
process.env.POLAR_WEBHOOK_SECRET = 'whsec_screenforge_test'
process.env.POLAR_LICENCE_PRODUCT_ID = 'prod_licence'
process.env.POLAR_CLOUD_PRODUCT_ID = 'prod_cloud'
process.env.POLAR_LICENCE_BENEFIT_ID = 'ben_licence'
process.env.CHECKOUT_SUCCESS_URL = 'http://localhost:5173/?checkout=success'

const { app } = await import('../index.ts')

function remove(token: string | null = 'jeton-valide') {
  return app.request('/account', {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('DELETE /account', () => {
  beforeEach(() => {
    supabase.calls.length = 0
    supabase.removedPaths.length = 0
    supabase.fail.listOffset = null
    supabase.fail.remove = false
    supabase.fail.deleteUser = false
    supabase.objects.length = 0
    supabase.objects.push({ name: 'a1' }, { name: 'a2' })
    auth.user = { id: USER, email: 'moi@example.com' }
  })

  it('supprime l’identité puis les binaires préalablement listés', async () => {
    const response = await remove()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true, cleanupPending: false })
    expect(supabase.calls).toEqual(['list:0', 'deleteUser', `remove:${USER}/a1,${USER}/a2`])
  })

  it('ne demande pas de suppression quand il n’y a aucun binaire', async () => {
    supabase.objects.length = 0
    const response = await remove()
    expect(response.status).toBe(200)
    expect(supabase.calls).toEqual(['list:0', 'deleteUser'])
  })

  it('sans jeton, rien n’est touché', async () => {
    auth.user = null
    const response = await remove(null)
    expect(response.status).toBe(401)
    expect(supabase.calls).toEqual([])
  })

  it('un jeton invalide ne supprime rien', async () => {
    auth.user = null
    const response = await remove('jeton-forgé')
    expect(response.status).toBe(401)
    expect(supabase.calls).toEqual([])
  })

  it('trace un nettoyage Storage en attente après la suppression de l’identité', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabase.fail.remove = true
    const response = await remove()
    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ deleted: true, cleanupPending: true })
    expect(supabase.calls).toEqual(['list:0', 'deleteUser', `remove:${USER}/a1,${USER}/a2`])
    expect(report).toHaveBeenCalledWith(
      'Account deleted with Storage cleanup pending.',
      expect.objectContaining({ userId: USER, objectCount: 2 }),
    )
    report.mockRestore()
  })

  it('un bucket injoignable arrête tout avant la suppression', async () => {
    supabase.fail.listOffset = 0
    const response = await remove()
    expect(response.status).toBe(502)
    expect(supabase.calls).toEqual(['list:0'])
  })

  it('liste plus de cent binaires avant l’identité puis les purge', async () => {
    supabase.objects.length = 0
    for (let index = 0; index < 101; index += 1) {
      supabase.objects.push({ name: `asset-${index}` })
    }

    const response = await remove()

    expect(response.status).toBe(200)
    expect(supabase.calls.slice(0, 2)).toEqual(['list:0', 'list:100'])
    expect(supabase.calls[2]).toBe('deleteUser')
    expect(supabase.calls.find((call) => call.startsWith('remove:'))?.split(',')).toHaveLength(101)
  })

  it('une page intermédiaire en échec ne supprime rien', async () => {
    supabase.objects.length = 0
    for (let index = 0; index < 150; index += 1) {
      supabase.objects.push({ name: `asset-${index}` })
    }
    supabase.fail.listOffset = 100

    const response = await remove()

    expect(response.status).toBe(502)
    expect(supabase.calls).toEqual(['list:0', 'list:100'])
  })

  it('un échec de suppression de l’identité ne supprime aucun asset', async () => {
    supabase.fail.deleteUser = true
    const response = await remove()
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'DELETE_FAILED' })
    expect(supabase.calls).toEqual(['list:0', 'deleteUser'])
    expect(supabase.removedPaths).toEqual([])
    expect(supabase.objects).toEqual([{ name: 'a1' }, { name: 'a2' }])
  })
})
