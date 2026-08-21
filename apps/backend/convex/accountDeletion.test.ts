import { authTables } from '@convex-dev/auth/server'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GenericValidator } from 'convex/values'
import { api, internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import {
  AUTH_TABLE_CLASSIFICATION,
  TABLES_OUTLIVING_THE_USER,
  TABLES_OWNED_BY_USER,
} from './accountDeletion'
import { consume, EMAIL_SCOPED_LIMITS, USER_SCOPED_LIMITS } from './limits'
import { png } from './media.test-fixtures'
import schema from './schema'
import {
  cloudAccount,
  errorCode,
  rateLimited,
  rateLimitValue,
  testConvex,
  useRateLimit,
} from './test.helpers'

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
const FIXTURE_EMAIL = 'deletion@screenforge.test'

type Stack = ReturnType<typeof testConvex>

/** Un compte complet : identité, sessions, achats, projets, binaires. */
async function populated(
  t: Stack,
  options: {
    assets?: number
    refreshTokens?: number
    verificationCodes?: number
    verifiers?: number
  } = {},
): Promise<Id<'users'>> {
  const assets = options.assets ?? 1
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', { email: FIXTURE_EMAIL })
    const sessionId = await ctx.db.insert('authSessions', {
      userId,
      expirationTime: 4_102_444_800_000,
    })
    for (let rank = 0; rank < (options.refreshTokens ?? 1); rank += 1) {
      await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: 4_102_444_800_000 })
    }
    for (let rank = 0; rank < (options.verifiers ?? 1); rank += 1) {
      await ctx.db.insert('authVerifiers', { sessionId, signature: `signature-${rank}` })
    }
    const accountId = await ctx.db.insert('authAccounts', {
      userId,
      provider: 'test-password',
      providerAccountId: FIXTURE_EMAIL,
      secret: 'hash',
    })
    for (let rank = 0; rank < (options.verificationCodes ?? 1); rank += 1) {
      await ctx.db.insert('authVerificationCodes', {
        accountId,
        provider: 'test-password',
        code: `code-${rank}`,
        expirationTime: 4_102_444_800_000,
      })
    }
    await ctx.db.insert('authRateLimits', {
      identifier: accountId,
      lastAttemptTime: Date.now(),
      attemptsLeft: 1,
    })
    await ctx.db.insert('authRateLimits', {
      identifier: FIXTURE_EMAIL,
      lastAttemptTime: Date.now(),
      attemptsLeft: 1,
    })
    await ctx.db.insert('entitlements', {
      userId,
      polarCustomerId: null,
      cloudStatus: null,
      cloudPeriodEnd: null,
      sourceUpdatedAt: null,
      complimentaryCloud: true,
      complimentaryNote: 'owner complimentary access',
    })
    await ctx.db.insert('userSettings', { userId, theme: 'light', updatedAt: 1 })
    const blobId = await ctx.storage.store(new Blob([JSON.stringify({ screens: [] })]))
    await ctx.db.insert('projects', {
      userId,
      projectId: 'projet-1',
      name: 'ScreenForge',
      updatedAt: 1_770_000_000_000,
      blobId,
      byteLength: 14,
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
      authVerifiers: (await ctx.db.query('authVerifiers').collect()).length,
      authRateLimits: (await ctx.db.query('authRateLimits').collect()).length,
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

/** Une ligne dont le fichier a déjà disparu. */
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

/**
 * Deux lignes historiques sur un seul fichier. Le transport actuel ne peut
 * plus les créer, mais la purge doit rester compatible avec celles qui existent.
 */
async function aliased(t: Stack, userId: Id<'users'>, assetId: string) {
  await t.run(async (ctx) => {
    const first = await ctx.db
      .query('assets')
      .withIndex('by_user_asset', (q) => q.eq('userId', userId))
      .first()
    if (first === null) throw new Error('Aucun binaire à dupliquer.')
    await ctx.db.insert('assets', {
      userId,
      assetId,
      storageId: first.storageId,
      contentType: PNG,
      byteLength: 4,
    })
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

beforeEach(() => {
  t = testConvex()
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

  it('classe chaque table Convex Auth, y compris les relations sans userId', () => {
    expect(Object.keys(AUTH_TABLE_CLASSIFICATION).sort()).toEqual(Object.keys(authTables).sort())
    expect(AUTH_TABLE_CLASSIFICATION).toMatchObject({
      authRefreshTokens: 'session-child',
      authVerificationCodes: 'account-child',
      authVerifiers: 'session-child',
      authRateLimits: 'account-or-email-child',
    })
  })
})

describe('requestAccountDeletion', () => {
  it('refuse avant toute suppression tant que la facturation Polar est active', async () => {
    const userId = await populated(t)
    await t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('entitlements')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()
      await ctx.db.patch(entitlement!._id, {
        polarCustomerId: `cus_${userId}`,
        cloudStatus: 'active',
        cloudPeriodEnd: '2099-01-01T00:00:00.000Z',
      })
    })

    await expect(remove(t, userId)).resolves.toBe('billing-active')
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 1,
      assets: 1,
      projects: 1,
      entitlements: 1,
      jobs: 0,
      files: 2,
    })
  })

  it('pose la barrière puis supprime entièrement un compte complimentary', async () => {
    const userId = await populated(t, { assets: 2 })

    await expect(remove(t, userId)).resolves.toBe('deleted')

    /* Critère 2 : on compte, on ne fait pas confiance. */
    await expect(leftovers(t, userId)).resolves.toEqual({
      authSessions: 0,
      authAccounts: 0,
      assets: 0,
      projects: 0,
      entitlements: 0,
      userSettings: 0,
      cloudDataClearJobs: 0,
      cloudDataStates: 0,
      billingCheckoutFences: 0,
      users: 0,
      authRefreshTokens: 0,
      authVerificationCodes: 0,
      authVerifiers: 0,
      authRateLimits: 0,
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

  it('reste disponible après l’état Polar sans abonnement Cloud actif', async () => {
    const userId = await populated(t)
    await t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('entitlements')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()
      await ctx.db.patch(entitlement!._id, {
        polarCustomerId: `cus_${userId}`,
        cloudStatus: null,
        cloudPeriodEnd: null,
      })
    })

    await expect(remove(t, userId)).resolves.toBe('deleted')
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.toBeNull()
  })

  it('ne prend pas une période locale dépassée pour une fin de facturation Polar', async () => {
    const userId = await populated(t)
    await t.run(async (ctx) => {
      const entitlement = await ctx.db
        .query('entitlements')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique()
      await ctx.db.patch(entitlement!._id, {
        polarCustomerId: `cus_${userId}`,
        cloudStatus: 'active',
        cloudPeriodEnd: '2020-01-01T00:00:00.000Z',
      })
    })

    await expect(remove(t, userId)).resolves.toBe('billing-active')
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.not.toBeNull()
  })

  it('bloque un checkout en attente et oublie seulement une URL expirée par Polar', async () => {
    const userId = await populated(t)
    const fenceId = await t.run((ctx) =>
      ctx.db.insert('billingCheckoutFences', { userId, expiresAt: null }),
    )

    await expect(remove(t, userId)).resolves.toBe('billing-active')
    await t.run((ctx) => ctx.db.patch(fenceId, { expiresAt: 0 }))
    await expect(remove(t, userId)).resolves.toBe('deleted')
  })

  it('recontrôle la facturation avant chaque reprise prepared', async () => {
    const userId = await populated(t)
    await t.run(async (ctx) => {
      await ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'prepared',
        attempts: 0,
        lastError: null,
      })
      await ctx.db.insert('billingCheckoutFences', {
        userId,
        expiresAt: new Date('2099-01-01T00:00:00.000Z').getTime(),
      })
    })

    await expect(t.mutation(internal.accountDeletion.resume, { userId })).resolves.toBe(
      'billing-active',
    )
    await expect(job(t, userId)).resolves.toBeNull()
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.not.toBeNull()
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
    /* Assez de binaires pour que la passe rende la main sur son budget : c'est
       ce qui donne une reprise à préserver. */
    const userId = await populated(t, { assets: 450 })
    await t.run((ctx) =>
      ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'cleanup',
        attempts: 3,
        lastError: 'storage down',
      }),
    )

    await expect(remove(t, userId)).resolves.toBe('cleanup-pending')

    /* Intacts, et non remis à zéro : la demande a repris le job en cours au lieu
       d'en ouvrir un neuf, sinon `attempts` et `lastError` auraient effacé la
       seule trace de ce qui résiste. */
    await expect(job(t, userId)).resolves.toMatchObject({
      status: 'cleanup',
      attempts: 3,
      lastError: 'storage down',
    })
    /* Le statut `cleanup` a aussi épargné l'identité, qui appartient à la passe
       précédente : une seconde demande ne recommence pas le travail fait. */
    await expect(t.run((ctx) => ctx.db.get(userId))).resolves.not.toBeNull()

    /* La reprise en file appartient au test : la laisser partir après lui la
       ferait écrire dans un simulateur déjà démonté. */
    await drain(t)
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
    const request = () => t.run((ctx) => consume(ctx, 'accountDeletion', userId))
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(request()).resolves.toBeNull()
    }

    await expect(request()).rejects.toSatisfy(rateLimited)
  })
})

/* Critère 3. */
describe('la barrière', () => {
  it('refuse un envoi de fichier émis après la ligne prepared, jeton encore valide', async () => {
    const userId = await cloudAccount(t)
    const as = t.withIdentity({ subject: userId })
    const upload = () =>
      as.fetch('/upload/asset?assetId=asset-1', {
        method: 'POST',
        headers: { 'Content-Type': PNG },
        body: new Blob([png(0, 4096)], { type: PNG }),
      })

    /* Le contre-test : sans la ligne, le même appel avec le même jeton passe. */
    await expect(upload().then((response) => response.status)).resolves.toBe(200)

    await t.run((ctx) =>
      ctx.db.insert('accountDeletionJobs', {
        userId,
        status: 'prepared',
        attempts: 0,
        lastError: null,
      }),
    )

    const response = await upload()
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ outcome: 'deletion-pending' })
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

  for (const count of [99, 100, 101]) {
    it(`supprime une session et ses ${String(count)} refresh tokens sans orphelin`, async () => {
      const userId = await populated(t, { assets: 0, refreshTokens: count })
      await expect(remove(t, userId)).resolves.toBe('deleted')
      await expect(leftovers(t, userId)).resolves.toMatchObject({
        users: 0,
        authSessions: 0,
        authRefreshTokens: 0,
        authVerifiers: 0,
        jobs: 0,
      })
    })
  }

  it('conserve la session quand le budget finit au milieu de 405 refresh tokens', async () => {
    const userId = await populated(t, { assets: 0, refreshTokens: 405 })

    await expect(remove(t, userId)).resolves.toBe('deletion-pending')
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 1,
      authSessions: 1,
      authRefreshTokens: 5,
      jobs: 1,
    })

    await drain(t, 8)
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 0,
      authSessions: 0,
      authRefreshTokens: 0,
      authVerifiers: 0,
      jobs: 0,
    })
  })

  it('conserve le compte quand le budget finit au milieu de ses codes', async () => {
    const userId = await populated(t, { assets: 0, verificationCodes: 405 })

    await expect(remove(t, userId)).resolves.toBe('deletion-pending')
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 1,
      authAccounts: 1,
      authVerificationCodes: 8,
      jobs: 1,
    })

    await drain(t, 8)
    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 0,
      authAccounts: 0,
      authVerificationCodes: 0,
      authRateLimits: 0,
      jobs: 0,
    })
  })

  /*
   * Critère 6, dans le sens qui compte : une suppression de compte finit.
   *
   * Un fichier absent n'est pas un fichier qui résiste — il n'y a plus d'octet
   * facturé à reprendre, donc la ligne doit partir. Sans cette distinction, les
   * deux cas ci-dessous laissaient une ligne que la passe ne pouvait plus faire
   * avancer, et le cron reprenait le même lot pour toujours : un compte demandé
   * en suppression ne l'était jamais. Le second cas est celui qu'un client
   * atteint tout seul, en confirmant deux `assetId` sur un même envoi.
   *
   * Ce qu'un refus **réel** du stockage produit — `attempts`, `lastError`, la
   * ligne conservée — ne se joue plus dans le simulateur, dont la seule panne
   * possible était justement le fichier absent. `phase-6.md` le porte avec les
   * autres écarts du simulateur.
   */
  it('termine malgré un fichier disparu, et malgré deux lignes sur un seul fichier', async () => {
    const userId = await populated(t, { assets: 1 })
    await withLostFile(t, userId, 'asset-perdu')
    await aliased(t, userId, 'asset-copie')

    await expect(remove(t, userId)).resolves.toBe('deleted')

    await expect(leftovers(t, userId)).resolves.toMatchObject({
      users: 0,
      assets: 0,
      projects: 0,
      jobs: 0,
      files: 0,
    })
  })

  it('ne supprime pas un fichier encore référencé par un autre compte', async () => {
    const userId = await populated(t, { assets: 1 })
    const other = await cloudAccount(t)
    const shared = await t.run(async (ctx) => {
      const source = await ctx.db
        .query('assets')
        .withIndex('by_user_asset', (q) => q.eq('userId', userId))
        .first()
      if (!source) throw new Error('Asset fixture missing.')
      await ctx.db.insert('projects', {
        userId: other,
        projectId: 'alias-autre-compte',
        name: 'Alias',
        updatedAt: 1,
        blobId: source.storageId,
        byteLength: 4,
      })
      return source.storageId
    })

    await expect(remove(t, userId)).resolves.toBe('deleted')
    expect(await t.run((ctx) => ctx.db.system.get(shared))).not.toBeNull()
    expect(
      (await t.withIdentity({ subject: other }).fetch('/project-blob/alias-autre-compte')).status,
    ).toBe(200)
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

describe('compteurs indirects', () => {
  it('réinitialise les clés compte et e-mail, jamais les limites réseau', async () => {
    const userId = await populated(t, { assets: 0 })
    for (const name of USER_SCOPED_LIMITS) await useRateLimit(t, name, userId)
    for (const name of EMAIL_SCOPED_LIMITS) await useRateLimit(t, name, FIXTURE_EMAIL)
    await useRateLimit(t, 'passwordSignUpGlobal')
    await useRateLimit(t, 'magicLinkSendGlobal')
    await useRateLimit(t, 'magicLinkSendBySource', 'source-key')
    await useRateLimit(t, 'polarWebhookBySource', 'source-key')
    await useRateLimit(t, 'polarWebhookGlobal')

    const globalBefore = await Promise.all([
      rateLimitValue(t, 'passwordSignUpGlobal'),
      rateLimitValue(t, 'magicLinkSendGlobal'),
      rateLimitValue(t, 'magicLinkSendBySource', 'source-key'),
      rateLimitValue(t, 'polarWebhookBySource', 'source-key'),
      rateLimitValue(t, 'polarWebhookGlobal'),
    ])
    await expect(remove(t, userId)).resolves.toBe('deleted')

    for (const name of USER_SCOPED_LIMITS) {
      expect((await rateLimitValue(t, name, userId)).ts).toBe(0)
    }
    for (const name of EMAIL_SCOPED_LIMITS) {
      expect((await rateLimitValue(t, name, FIXTURE_EMAIL)).ts).toBe(0)
    }
    const globalAfter = await Promise.all([
      rateLimitValue(t, 'passwordSignUpGlobal'),
      rateLimitValue(t, 'magicLinkSendGlobal'),
      rateLimitValue(t, 'magicLinkSendBySource', 'source-key'),
      rateLimitValue(t, 'polarWebhookBySource', 'source-key'),
      rateLimitValue(t, 'polarWebhookGlobal'),
    ])
    expect(globalAfter).toEqual(globalBefore)
  })
})
