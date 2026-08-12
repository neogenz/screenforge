import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenericValidator } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { TABLES_OUTLIVING_THE_USER, TABLES_OWNED_BY_USER } from './accountDeletion'
import schema from './schema'
import { cloudAccount, errorCode, rateLimited, testConvex } from './test.helpers'

/**
 * La suppression de compte, cas par cas : le seul geste irréversible du
 * produit, et le plus long fichier de tests du déploiement pour cette seule
 * raison.
 *
 * Deux ambiguïtés sont délibérément hors d'ici, et elles sont nommées plutôt
 * que laissées invisibles :
 *
 * - **Une réponse qui se perd après coup.** L'identité se supprime dans la même
 *   transaction que le reste : côté déploiement elle est là ou elle n'est plus,
 *   il n'y a pas de cas ambigu à observer. Ce qui reste incertain est le trajet
 *   du retour, et c'est `'unknown'` côté client qui le porte —
 *   `apps/web/src/lib/__tests__/account.test.ts` le couvre.
 * - **Une file écrite sans que le travail commence.** La file et le travail
 *   sont la même transaction : elle ne peut pas manquer pendant que le reste
 *   avance. La seule barrière qui reste franchissable est celle que voit un
 *   jeton encore valide, et « sans jeton, rien d'irréversible ne commence »
 *   plus « refuse un envoi de fichier émis après la ligne prepared » la
 *   vérifient.
 */

const PNG = 'image/png'

type Stack = ReturnType<typeof testConvex>

/** Un compte complet : identité, sessions, achats, projets, binaires. */
async function populated(t: Stack, options: { assets?: number } = {}): Promise<Id<'users'>> {
  const assets = options.assets ?? 1
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { email: 'maxime.desogus@gmail.com' })
    const sessionId = await ctx.db.insert('authSessions', {
      userId,
      expirationTime: 4_102_444_800_000,
    })
    await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: 4_102_444_800_000 })
    const accountId = await ctx.db.insert('authAccounts', {
      userId,
      provider: 'password',
      providerAccountId: 'maxime.desogus@gmail.com',
      secret: 'hash',
    })
    await ctx.db.insert('authVerificationCodes', {
      accountId,
      provider: 'password',
      code: 'code-en-attente',
      expirationTime: 4_102_444_800_000,
    })
    await ctx.db.insert('entitlements', {
      userId,
      polarCustomerId: `cus_${userId}`,
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'active',
      cloudPeriodEnd: '2099-01-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    })
    const blobId = await ctx.storage.store(new Blob([JSON.stringify({ screens: [] })]))
    await ctx.db.insert('projects', {
      userId,
      projectId: 'projet-1',
      name: 'ScreenForge',
      updatedAt: 1_770_000_000_000,
      blobId,
    })
    for (let rank = 0; rank < assets; rank += 1) {
      const storageId = await ctx.storage.store(new Blob([new Uint8Array(4)], { type: PNG }))
      await ctx.db.insert('assets', {
        userId,
        assetId: `asset-${rank}`,
        storageId,
        contentType: PNG,
        byteLength: 4,
      })
    }
    return userId
  })
}

function remove(t: Stack, userId: string | null) {
  const caller = userId === null ? t : t.withIdentity({ subject: userId })
  return caller.mutation(api.accountDeletion.requestAccountDeletion, {})
}

/**
 * Ce qu'il reste du compte, compté et non supposé — critère 2.
 *
 * Les tables possédées sont lues depuis `TABLES_OWNED_BY_USER` : une table
 * inscrite demain est comptée sans qu'on ait à revenir ici, et le total est donc
 * celui de la liste et non celui que ce test se rappelle.
 */
async function leftovers(t: Stack, userId: Id<'users'>): Promise<Record<string, number>> {
  return await t.run(async (ctx) => {
    const counts: Record<string, number> = {}
    for (const table of TABLES_OWNED_BY_USER) {
      const rows = await ctx.db.query(table as 'assets').collect()
      counts[table] = rows.filter((row) => row.userId === userId).length
    }
    return {
      ...counts,
      users: (await ctx.db.get(userId)) === null ? 0 : 1,
      authRefreshTokens: (await ctx.db.query('authRefreshTokens').collect()).length,
      authVerificationCodes: (await ctx.db.query('authVerificationCodes').collect()).length,
      jobs: (await ctx.db.query('accountDeletionJobs').collect()).length,
      files: (await ctx.db.system.query('_storage').collect()).length,
    }
  })
}

async function job(t: Stack, userId: string) {
  return await t.run((ctx) =>
    ctx.db
      .query('accountDeletionJobs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique(),
  )
}

/**
 * Un binaire dont le fichier a déjà disparu.
 *
 * C'est la seule façon de faire échouer `ctx.storage.delete` dans le
 * simulateur, qui lève « Delete on non-existent doc ». La panne y est
 * définitive, là où celle d'origine (`fail.remove`) se rallumait : la reprise se
 * teste donc en **réparant** la ligne, ce que fait `restore`.
 */
async function withLostFile(t: Stack, userId: Id<'users'>, assetId: string) {
  return await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(4)], { type: PNG }))
    const id = await ctx.db.insert('assets', {
      userId,
      assetId,
      storageId,
      contentType: PNG,
      byteLength: 4,
    })
    await ctx.storage.delete(storageId)
    return id
  })
}

/** Le stockage répond de nouveau : le fichier existe, la ligne le désigne. */
async function restore(t: Stack, assetId: Id<'assets'>) {
  await t.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(4)], { type: PNG }))
    await ctx.db.patch(assetId, { storageId })
  })
}

/**
 * Laisser courir ce que le déploiement aurait planifié.
 *
 * `finishInProgressScheduledFunctions` n'attend que les travaux déjà démarrés,
 * et `runAfter(0)` passe par un `setTimeout` : le tour de boucle cède d'abord la
 * main pour que le minuteur parte. Plusieurs tours, parce qu'une passe peut en
 * replanifier une autre.
 */
async function drain(t: Stack, rounds = 4) {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await t.finishInProgressScheduledFunctions()
  }
}

let t: Stack
let report: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  t = testConvex()
  report = vi.spyOn(console, 'error').mockImplementation(() => {})
})

/**
 * Le test qui tient lieu de cascade.
 *
 * Rien n'emporte les lignes filles d'un compte : la liste des tables qui lui
 * appartiennent est écrite à la main, et une liste écrite à la main s'oublie.
 * Celui-ci lit le schéma, pas la liste — une table ajoutée demain avec un champ
 * `userId` fait échouer cette assertion tant qu'elle n'a pas été classée,
 * possédée ou survivante.
 */
describe('le schéma, énuméré', () => {
  function fieldsOf(validator: GenericValidator): string[] {
    return validator.kind === 'object' ? Object.keys(validator.fields) : []
  }

  it('ne laisse aucune table porteuse de userId hors de la liste', () => {
    const carryingUserId = Object.entries(schema.tables)
      .filter(([, table]) => fieldsOf(table.validator).includes('userId'))
      .map(([name]) => name)

    expect(carryingUserId.length).toBeGreaterThan(0)
    expect([...carryingUserId].sort()).toEqual(
      [...TABLES_OWNED_BY_USER, ...TABLES_OUTLIVING_THE_USER].sort(),
    )
  })

  it('ne compte l’exception qu’une fois, et sait laquelle', () => {
    /* Le contre-test : si la table de file passait « possédée », le balayage
       supprimerait ce qui dit que le balayage n'est pas fini. */
    expect(TABLES_OUTLIVING_THE_USER).toEqual(['accountDeletionJobs'])
    expect(TABLES_OWNED_BY_USER).not.toContain('accountDeletionJobs')
  })
})

describe('requestAccountDeletion', () => {
  it('pose la barrière durable avant l’identité puis vide le dossier', async () => {
    const userId = await populated(t, { assets: 2 })

    await expect(remove(t, userId)).resolves.toBe('deleted')

    /* Critère 2 : on compte, on ne fait pas confiance. */
    await expect(leftovers(t, userId)).resolves.toEqual({
      authSessions: 0,
      authAccounts: 0,
      assets: 0,
      projects: 0,
      entitlements: 0,
      users: 0,
      authRefreshTokens: 0,
      authVerificationCodes: 0,
      jobs: 0,
      files: 0,
    })
  })

  it('termine sans suppression Storage quand le dossier est déjà vide', async () => {
    const userId = await t.run((ctx) => ctx.db.insert('users', {}))

    await expect(remove(t, userId)).resolves.toBe('deleted')
    await expect(job(t, userId)).resolves.toBeNull()
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.toBeNull()
  })

  it('sans jeton, rien d’irréversible ne commence', async () => {
    const userId = await populated(t)

    await expect(remove(t, null)).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'UNAUTHENTICATED',
    )
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 1,
      assets: 1,
      projects: 1,
      jobs: 0,
      files: 2,
    })
  })

  it('un jeton qui ne désigne aucun compte ne touche ni file, ni identité, ni asset', async () => {
    const userId = await populated(t)

    /* La ligne de file s'ouvre puis se referme dans la même transaction : un
       identifiant qui n'a jamais été un `Id<'users'>` ne désigne rien à
       nettoyer, et la garder ferait tourner le cron pour toujours. */
    await expect(remove(t, 'jeton-forgé')).resolves.toBe('deleted')
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 1,
      assets: 1,
      projects: 1,
      jobs: 0,
      files: 2,
    })
  })

  it('préserve un job cleanup quand une nouvelle requête prépare le même compte', async () => {
    const userId = await populated(t, { assets: 0 })
    await withLostFile(t, userId, 'asset-perdu')
    await t.run((ctx) =>
      ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'cleanup',
        attempts: 3,
        lastError: 'storage down',
      }),
    )

    await expect(remove(t, userId)).resolves.toBe('cleanup-pending')

    /* 4 et non 1 : la demande a repris le job en cours au lieu d'en ouvrir un
       neuf, sinon `attempts` aurait effacé la seule trace de ce qui résiste. */
    await expect(job(t, userId)).resolves.toMatchObject({
      status: 'cleanup',
      attempts: 4,
      lastError: expect.any(String),
    })
    /* Le statut `cleanup` a aussi épargné l'identité, qui appartient à la passe
       précédente : une seconde demande ne recommence pas le travail fait. */
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.not.toBeNull()
  })

  it('traite deux demandes concurrentes sans perdre la file ni répéter la purge', async () => {
    const userId = await populated(t, { assets: 2 })

    const outcomes = await Promise.all([remove(t, userId), remove(t, userId)])

    expect(outcomes).toEqual(['deleted', 'deleted'])
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 0,
      assets: 0,
      projects: 0,
      entitlements: 0,
      jobs: 0,
      files: 0,
    })
  })

  /* Critère 7. */
  it('refuse la quatrième demande de l’heure', async () => {
    const userId = await populated(t, { assets: 0 })
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(remove(t, userId)).resolves.toBe('deleted')
    }

    await expect(remove(t, userId)).rejects.toSatisfy(rateLimited)
  })
})

/* Critère 3. */
describe('la barrière', () => {
  it('refuse un envoi de fichier émis après la ligne prepared, jeton encore valide', async () => {
    const userId = await cloudAccount(t)
    const as = t.withIdentity({ subject: userId })
    const upload = () =>
      as.mutation(api.assets.requestAssetUpload, {
        assetId: 'asset-1',
        contentType: PNG,
        byteLength: 4096,
      })

    /* Le contre-test : sans la ligne, le même appel avec le même jeton passe. */
    await expect(upload()).resolves.toEqual(expect.any(String))

    await t.run((ctx) =>
      ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'prepared',
        attempts: 0,
        lastError: null,
      }),
    )

    await expect(upload()).rejects.toSatisfy(
      (error: unknown) => errorCode(error) === 'DELETION_PENDING',
    )
  })
})

describe('la reprise', () => {
  /* Critère 4. */
  it('donne le même état appelée deux fois de suite', async () => {
    const userId = await populated(t, { assets: 2 })
    await expect(remove(t, userId)).resolves.toBe('deleted')
    const after = await leftovers(t, userId)

    await expect(t.mutation(internal.accountDeletion.resume, { userId })).resolves.toBe('deleted')
    await expect(t.mutation(internal.accountDeletion.resume, { userId })).resolves.toBe('deleted')

    await expect(leftovers(t, userId)).resolves.toEqual(after)
  })

  /* Critère 5 : plus d'un lot, donc au moins une replanification. */
  it('nettoie entièrement un compte qui déborde d’une passe', async () => {
    const userId = await populated(t, { assets: 450 })

    await expect(remove(t, userId)).resolves.toBe('cleanup-pending')

    /* La première passe s'est arrêtée sur son budget, pas sur une erreur :
       l'identité est partie, il reste des binaires, et une reprise est en
       file. */
    const midway = await leftovers(t, userId)
    expect(midway.users).toBe(0)
    expect(midway.assets).toBeGreaterThan(0)
    expect(midway.jobs).toBe(1)
    await expect(
      t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect()),
    ).resolves.not.toHaveLength(0)

    await drain(t)

    await expect(leftovers(t, userId)).resolves.toMatchObject({
      assets: 0,
      projects: 0,
      entitlements: 0,
      jobs: 0,
      files: 0,
    })
  })

  /* Critère 6. */
  it('laisse la ligne en place sur un échec de fichier, puis termine au tour suivant', async () => {
    const userId = await populated(t, { assets: 1 })
    const bloqué = await withLostFile(t, userId, 'asset-perdu')

    await expect(remove(t, userId)).resolves.toBe('cleanup-pending')

    /* Le reste de la passe a bien été commis : lever aurait tout annulé. */
    const midway = await leftovers(t, userId)
    expect(midway.users).toBe(0)
    expect(midway.assets).toBe(1)
    expect(midway.projects).toBe(0)
    await expect(job(t, userId)).resolves.toMatchObject({
      status: 'cleanup',
      attempts: 1,
      lastError: expect.any(String),
    })
    expect(report).toHaveBeenCalled()

    await restore(t, bloqué)
    await expect(t.mutation(internal.accountDeletion.resume, { userId })).resolves.toBe('deleted')

    await expect(leftovers(t, userId)).resolves.toMatchObject({ assets: 0, jobs: 0, files: 0 })
  })

  it('reprend un job prepared jusqu’à supprimer identité et fichiers', async () => {
    const userId = await populated(t, { assets: 2 })
    await t.run((ctx) =>
      ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'prepared',
        attempts: 0,
        lastError: null,
      }),
    )

    await expect(t.mutation(internal.accountDeletion.resumeAll, {})).resolves.toBe(1)
    await drain(t)

    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 0,
      authSessions: 0,
      assets: 0,
      projects: 0,
      jobs: 0,
      files: 0,
    })
  })

  it('ne planifie rien quand la file est vide', async () => {
    await expect(t.mutation(internal.accountDeletion.resumeAll, {})).resolves.toBe(0)
  })
})
