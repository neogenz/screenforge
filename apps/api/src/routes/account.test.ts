import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * La suppression de compte, et l'ordre dans lequel elle efface.
 *
 * Les binaires partent avant l'identité, et ce n'est pas un détail de style :
 * `storage.objects` ne référence pas `auth.users` — c'est le chemin
 * `{user_id}/{asset_id}` qui porte l'appartenance. Supprimer l'identité d'abord
 * laisserait des fichiers dont plus rien ne dirait à qui ils étaient, dans un
 * bucket privé que plus aucune policy ne rend lisible. Une fuite qui coûte du
 * stockage pour toujours et qu'aucun écran ne montre.
 */
const supabase = vi.hoisted(() => {
  const calls: string[] = []
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
  return { calls, fail, objects, client }
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
    supabase.fail.listOffset = null
    supabase.fail.remove = false
    supabase.fail.deleteUser = false
    supabase.objects.length = 0
    supabase.objects.push({ name: 'a1' }, { name: 'a2' })
    auth.user = { id: USER, email: 'moi@example.com' }
  })

  it('purge les binaires puis l’identité', async () => {
    const response = await remove()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true })
    expect(supabase.calls).toEqual(['list:0', `remove:${USER}/a1,${USER}/a2`, 'deleteUser'])
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

  it('une purge en échec laisse l’identité en place', async () => {
    /* L'inverse — supprimer l'identité malgré l'échec du bucket — rendrait les
       fichiers définitivement orphelins : plus aucun compte pour les réclamer,
       et un chemin que plus aucune policy ne laisse lire. */
    supabase.fail.remove = true
    const response = await remove()
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'PURGE_FAILED' })
    expect(supabase.calls).not.toContain('deleteUser')
  })

  it('un bucket injoignable arrête tout avant la suppression', async () => {
    supabase.fail.listOffset = 0
    const response = await remove()
    expect(response.status).toBe(502)
    expect(supabase.calls).toEqual(['list:0'])
  })

  it('purge plus de cent binaires avant de supprimer l’identité', async () => {
    supabase.objects.length = 0
    for (let index = 0; index < 101; index += 1) {
      supabase.objects.push({ name: `asset-${index}` })
    }

    const response = await remove()

    expect(response.status).toBe(200)
    expect(supabase.calls.slice(0, 2)).toEqual(['list:0', 'list:100'])
    expect(supabase.calls.at(-1)).toBe('deleteUser')
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

  it('un échec de suppression de l’identité est signalé', async () => {
    supabase.fail.deleteUser = true
    const response = await remove()
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'DELETE_FAILED' })
  })
})
