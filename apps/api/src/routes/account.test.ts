import { beforeEach, describe, expect, it, vi } from 'vitest'

const USER = '11111111-1111-4111-8111-111111111111'

const supabase = vi.hoisted(() => {
  interface Job {
    user_id: string
    status: 'prepared' | 'cleanup'
    attempts: number
    last_error: string | null
    created_at: string
  }

  const calls: string[] = []
  const objects: { name: string }[] = []
  const jobs = new Map<string, Job>()
  const fail = {
    queue: false,
    list: false,
    remove: false,
    deleteUser: 'none' as 'none' | 'before' | 'after',
    getUser: false,
    cancelJob: false,
  }
  let identityExists = true

  const jobsTable = {
    upsert: async (row: Partial<Job> & { user_id: string }) => {
      calls.push('job:upsert')
      if (!fail.queue && !jobs.has(row.user_id)) {
        jobs.set(row.user_id, {
          user_id: row.user_id,
          status: row.status ?? 'prepared',
          attempts: row.attempts ?? 0,
          last_error: row.last_error ?? null,
          created_at: new Date().toISOString(),
        })
      }
      return { error: fail.queue ? new Error('queue down') : null }
    },
    delete: () => ({
      match: async ({ user_id: userId, status }: { user_id: string; status?: Job['status'] }) => {
        calls.push('job:delete')
        if (fail.cancelJob) return { error: new Error('database down') }
        if (!status || jobs.get(userId)?.status === status) jobs.delete(userId)
        return { error: null }
      },
      eq: async (_column: string, userId: string) => {
        calls.push('job:delete')
        jobs.delete(userId)
        return { error: null }
      },
    }),
    update: (values: Partial<Job>) => ({
      eq: async (_column: string, userId: string) => {
        calls.push(`job:update:${values.status ?? 'failure'}`)
        const job = jobs.get(userId)
        if (job) jobs.set(userId, { ...job, ...values })
        return { error: null }
      },
    }),
    select: (columns: string) =>
      columns === 'attempts'
        ? {
            eq: (_column: string, userId: string) => ({
              maybeSingle: async () => ({ data: jobs.get(userId) ?? null, error: null }),
            }),
          }
        : columns === 'user_id, status'
          ? {
              eq: (_column: string, userId: string) => ({
                maybeSingle: async () => {
                  calls.push('job:read')
                  return { data: jobs.get(userId) ?? null, error: null }
                },
              }),
              order: async () => ({ data: [...jobs.values()], error: null }),
            }
          : {
              order: async () => ({ data: [...jobs.values()], error: null }),
            },
  }

  const client = {
    from: (table: string) => {
      if (table !== 'account_deletion_jobs') throw new Error(`Unexpected table ${table}`)
      return jobsTable
    },
    storage: {
      from: () => ({
        list: async (_path: string, options: { limit: number; offset: number }) => {
          calls.push(`list:${options.offset}`)
          return fail.list
            ? { data: null, error: new Error('storage down') }
            : { data: objects.slice(0, options.limit), error: null }
        },
        remove: async (paths: string[]) => {
          calls.push(`remove:${paths.length}`)
          if (!fail.remove) {
            const removed = new Set(paths.map((path) => path.slice(path.indexOf('/') + 1)))
            const kept = objects.filter((object) => !removed.has(object.name))
            objects.splice(0, objects.length, ...kept)
          }
          return { error: fail.remove ? new Error('storage down') : null }
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async () => {
          calls.push('deleteUser')
          if (!identityExists) return { error: new Error('User not found') }
          if (fail.deleteUser === 'before') return { error: new Error('auth down') }
          identityExists = false
          return { error: fail.deleteUser === 'after' ? new Error('response lost') : null }
        },
        getUserById: async () => {
          calls.push('getUserById')
          if (fail.getUser) {
            return { data: { user: null }, error: { status: 503, message: 'auth unavailable' } }
          }
          return identityExists
            ? { data: { user: { id: USER } }, error: null }
            : { data: { user: null }, error: { status: 404, message: 'User not found' } }
        },
      },
    },
  }

  return {
    calls,
    objects,
    jobs,
    fail,
    client,
    setIdentityExists: (value: boolean) => {
      identityExists = value
    },
    identityExists: () => identityExists,
  }
})

const auth = vi.hoisted(() => ({
  user: null as { id: string; email: string | null } | null,
}))

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

const [{ app }, { prepareAccountDeletion, resumeAccountDeletionJobs }] = await Promise.all([
  import('../index.ts'),
  import('../account-deletion.ts'),
])

function remove(token: string | null = 'jeton-valide') {
  return app.request('/account', {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

describe('DELETE /account', () => {
  beforeEach(() => {
    supabase.calls.length = 0
    supabase.objects.splice(0, supabase.objects.length, { name: 'a1' }, { name: 'a2' })
    supabase.jobs.clear()
    supabase.fail.queue = false
    supabase.fail.list = false
    supabase.fail.remove = false
    supabase.fail.deleteUser = 'none'
    supabase.fail.getUser = false
    supabase.fail.cancelJob = false
    supabase.setIdentityExists(true)
    auth.user = { id: USER, email: 'moi@example.com' }
  })

  it('pose la barrière durable avant l’identité puis vide le dossier', async () => {
    const response = await remove()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ deleted: true, cleanupPending: false })
    expect(supabase.calls).toEqual([
      'job:upsert',
      'job:read',
      'deleteUser',
      'job:update:cleanup',
      'list:0',
      'remove:2',
      'list:0',
      'job:delete',
    ])
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
  })

  it('termine sans suppression Storage quand le dossier est déjà vide', async () => {
    supabase.objects.length = 0

    const response = await remove()

    expect(response.status).toBe(200)
    expect(supabase.calls).toEqual([
      'job:upsert',
      'job:read',
      'deleteUser',
      'job:update:cleanup',
      'list:0',
      'job:delete',
    ])
  })

  it('un échec deleteUser confirmé avant suppression retire la demande sans toucher aux assets', async () => {
    supabase.fail.deleteUser = 'before'

    const response = await remove()

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'DELETE_FAILED' })
    expect(supabase.calls).toEqual([
      'job:upsert',
      'job:read',
      'deleteUser',
      'getUserById',
      'job:delete',
    ])
    expect(supabase.objects).toEqual([{ name: 'a1' }, { name: 'a2' }])
    expect(supabase.jobs.size).toBe(0)
  })

  it('préserve un job cleanup quand une nouvelle requête prépare le même compte', async () => {
    supabase.jobs.set(USER, {
      user_id: USER,
      status: 'cleanup',
      attempts: 3,
      last_error: 'storage down',
      created_at: '2026-08-09T12:00:00.000Z',
    })

    await expect(prepareAccountDeletion(USER)).resolves.toBe(true)

    expect(supabase.jobs.get(USER)).toMatchObject({
      status: 'cleanup',
      attempts: 3,
      last_error: 'storage down',
    })
  })

  it('traite deux DELETE concurrents sans perdre la file ni répéter la purge', async () => {
    const responses = await Promise.all([remove(), remove()])

    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(supabase.calls.filter((call) => call === 'deleteUser')).toHaveLength(1)
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
    expect(supabase.identityExists()).toBe(false)
  })

  it('une suppression réussie dont la réponse se perd est réconciliée jusqu’à zéro objet', async () => {
    supabase.fail.deleteUser = 'after'

    const response = await remove()

    expect(response.status).toBe(200)
    expect(supabase.calls).toContain('getUserById')
    expect(supabase.identityExists()).toBe(false)
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
  })

  it('un résultat Auth ambigu conserve le job prepared et ne touche aucun asset', async () => {
    supabase.fail.deleteUser = 'before'
    supabase.fail.getUser = true

    const response = await remove()

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      deleted: false,
      cleanupPending: true,
      outcome: 'deletion-pending',
    })
    expect(supabase.jobs.get(USER)).toMatchObject({ status: 'prepared', attempts: 1 })
    expect(supabase.objects).toEqual([{ name: 'a1' }, { name: 'a2' }])

    supabase.fail.deleteUser = 'none'
    supabase.fail.getUser = false
    await resumeAccountDeletionJobs()
    expect(supabase.identityExists()).toBe(false)
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
  })

  it('un échec de retrait du job reste pending puis le worker termine', async () => {
    supabase.fail.deleteUser = 'before'
    supabase.fail.cancelJob = true

    const response = await remove()

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({
      deleted: false,
      cleanupPending: true,
      outcome: 'deletion-pending',
    })
    expect(supabase.identityExists()).toBe(true)
    expect(supabase.jobs.get(USER)).toMatchObject({ status: 'prepared', attempts: 1 })
    expect(supabase.objects).toHaveLength(2)

    supabase.fail.deleteUser = 'none'
    supabase.fail.cancelJob = false
    await resumeAccountDeletionJobs()

    expect(supabase.identityExists()).toBe(false)
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
  })

  it('un échec Storage reste en file puis le worker reprend jusqu’à zéro objet', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabase.fail.remove = true

    const response = await remove()

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ deleted: true, cleanupPending: true })
    expect(supabase.objects).toHaveLength(2)
    expect(supabase.jobs.get(USER)).toMatchObject({ status: 'cleanup', attempts: 1 })

    supabase.fail.remove = false
    await resumeAccountDeletionJobs()

    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
    expect(supabase.calls.filter((call) => call === 'remove:2')).toHaveLength(2)
    report.mockRestore()
  })

  it('un échec de listing Storage reste en file puis le worker reprend', async () => {
    const report = vi.spyOn(console, 'error').mockImplementation(() => {})
    supabase.fail.list = true

    const response = await remove()

    expect(response.status).toBe(202)
    expect(supabase.objects).toHaveLength(2)
    expect(supabase.jobs.get(USER)).toMatchObject({ status: 'cleanup', attempts: 1 })

    supabase.fail.list = false
    await resumeAccountDeletionJobs()

    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
    report.mockRestore()
  })

  it('reliste offset zéro pour purger plus de cent objets sans saut', async () => {
    supabase.objects.length = 0
    for (let index = 0; index < 201; index += 1) {
      supabase.objects.push({ name: `asset-${index}` })
    }

    const response = await remove()

    expect(response.status).toBe(200)
    expect(supabase.calls.filter((call) => call === 'list:0')).toHaveLength(4)
    expect(supabase.calls.filter((call) => call.startsWith('remove:'))).toEqual([
      'remove:100',
      'remove:100',
      'remove:1',
    ])
    expect(supabase.objects).toEqual([])
  })

  it('le worker reprend un job prepared jusqu’à supprimer identité et Storage', async () => {
    supabase.jobs.set(USER, {
      user_id: USER,
      status: 'prepared',
      attempts: 0,
      last_error: null,
      created_at: new Date().toISOString(),
    })

    await resumeAccountDeletionJobs()

    expect(supabase.calls).toContain('deleteUser')
    expect(supabase.identityExists()).toBe(false)
    expect(supabase.objects).toEqual([])
    expect(supabase.jobs.size).toBe(0)
  })

  it('sans jeton, rien d’irréversible ne commence', async () => {
    auth.user = null
    expect((await remove(null)).status).toBe(401)
    expect(supabase.calls).toEqual([])
  })

  it('un jeton invalide ne touche ni file, ni identité, ni asset', async () => {
    auth.user = null
    expect((await remove('jeton-forgé')).status).toBe(401)
    expect(supabase.calls).toEqual([])
  })

  it('sans file durable, rien d’irréversible ne commence', async () => {
    auth.user = { id: USER, email: null }
    supabase.fail.queue = true
    const response = await remove()
    expect(response.status).toBe(502)
    expect(supabase.calls).toEqual(['job:upsert'])
    expect(supabase.objects).toHaveLength(2)
  })
})
