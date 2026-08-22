import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import {
  env,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from './_generated/server'
import { requireUser } from './authz'
import { consume, normalizeEmail, resetAccountLimits } from './limits'
import { deleteIfUnreferenced } from './storageReferences'

/**
 * La suppression de compte, sans cascade.
 *
 * Rien ne suit les lignes filles d'un compte : supprimer veut dire nommer
 * chaque table qui lui appartient, et une chaîne écrite à la main a un défaut
 * connu — la table ajoutée demain n'y est jamais inscrite. Ce risque ne se
 * tient pas en s'en souvenant. Deux mesures, et elles vont ensemble. La liste
 * vit ici et nulle part ailleurs — ce sont les clés de `IDENTITY_PURGES` et de
 * `DATA_PURGES`, réunies dans `TABLES_OWNED_BY_USER`. Et
 * `accountDeletion.test.ts` énumère le schéma : toute table portant un champ
 * `userId` doit être dans cette liste, ou être l'exception déclarée
 * (`accountDeletionJobs`, qui survit exprès au compte). C'est ce test qui tient
 * lieu de cascade, et c'est lui qui attrapera la table ajoutée demain.
 *
 * Le nom du fichier n'est pas en `kebab-case` comme le reste du dépôt, et ce
 * n'est pas un oubli : Convex refuse la poussée d'un module dont le chemin
 * porte un tiret (« can only contain alphanumeric characters, underscores, or
 * periods »). Il suit donc le nom sous lequel les fonctions s'appellent,
 * `internal.accountDeletion.*`.
 *
 * La machine à états est idempotente, sérialisée par compte, et pose sa
 * barrière durable **avant** toute opération irréversible. L'identité se
 * supprime dans la même transaction que le reste : elle est là ou elle n'est
 * plus, il n'y a pas de troisième cas à réconcilier côté déploiement. La seule
 * ambiguïté qui subsiste est entre le navigateur et le déploiement — une
 * réponse peut se perdre après que tout a été fait — et c'est `'unknown'`,
 * côté client, qui la porte.
 */

/**
 * Ce qu'une passe s'autorise à supprimer.
 *
 * Une mutation Convex écrit au plus 16 000 documents et lit au plus 16 MiB ;
 * 400 laisse la marge que les lectures consomment, et surtout garde chaque passe
 * courte. Un compte ordinaire tient entièrement dans la première.
 */
const PASS_BUDGET = 400

/** Ce qu'un seul index rend par lot. */
const BATCH = 100

interface Budget {
  left: number
  /** Ce qui a échoué sans faire échouer la passe — voir `forget`. */
  failures: string[]
}

type Purge = (ctx: MutationCtx, userId: Id<'users'>, budget: Budget) => Promise<void>

export const AUTH_TABLE_CLASSIFICATION = {
  users: 'identity',
  authSessions: 'user-child',
  authAccounts: 'user-child',
  authRefreshTokens: 'session-child',
  authVerificationCodes: 'account-child',
  authVerifiers: 'session-child',
  authRateLimits: 'account-or-email-child',
} as const satisfies Record<keyof typeof authTables, string>

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Oublier un fichier, et survivre à son refus.
 *
 * Le `catch` n'est pas de la politesse : une mutation Convex est une
 * transaction, donc une erreur qui s'échappe annule **tout** ce que la passe
 * vient de supprimer, y compris ce qui avait réussi. Attrapée, elle laisse le
 * travail fait, laisse le document dont le fichier résiste, et se retrouve dans
 * `lastError`. C'est la version Convex de « Account deletion cleanup remains
 * queued ».
 *
 * Les uploads ne créent plus d'alias, mais les données historiques peuvent en
 * contenir. La suppression consulte donc les deux indexes de références en
 * excluant seulement la ligne en cours. Une autre référence conserve les
 * octets; la dernière les retire. Un refus **réel** du stockage laisse la ligne
 * et le job pour la reprise suivante.
 *
 * La recherche et la suppression sont dans le même `try` : leur erreur ne doit
 * pas annuler le reste de la passe.
 */
async function forget(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  budget: Budget,
  reference: { table: 'projects'; id: Id<'projects'> } | { table: 'assets'; id: Id<'assets'> },
): Promise<boolean> {
  try {
    await deleteIfUnreferenced(ctx, storageId, reference)
    return true
  } catch (error) {
    budget.failures.push(message(error))
    return false
  }
}

async function drainRefreshTokens(
  ctx: MutationCtx,
  sessionId: Id<'authSessions'>,
  budget: Budget,
): Promise<boolean> {
  while (budget.left > 0) {
    const rows = await ctx.db
      .query('authRefreshTokens')
      .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
      .take(Math.min(BATCH, budget.left))
    if (rows.length === 0) return true
    for (const row of rows) {
      await ctx.db.delete(row._id)
      budget.left -= 1
    }
  }
  return false
}

async function drainVerifiers(
  ctx: MutationCtx,
  sessionId: Id<'authSessions'>,
  budget: Budget,
): Promise<boolean> {
  while (budget.left > 0) {
    const rows = await ctx.db
      .query('authVerifiers')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
      .take(Math.min(BATCH, budget.left))
    if (rows.length === 0) return true
    for (const row of rows) {
      await ctx.db.delete(row._id)
      budget.left -= 1
    }
  }
  return false
}

async function drainVerificationCodes(
  ctx: MutationCtx,
  accountId: Id<'authAccounts'>,
  budget: Budget,
): Promise<boolean> {
  while (budget.left > 0) {
    const rows = await ctx.db
      .query('authVerificationCodes')
      .withIndex('accountId', (q) => q.eq('accountId', accountId))
      .take(Math.min(BATCH, budget.left))
    if (rows.length === 0) return true
    for (const row of rows) {
      await ctx.db.delete(row._id)
      budget.left -= 1
    }
  }
  return false
}

async function deleteAuthRateLimit(
  ctx: MutationCtx,
  identifier: string,
  budget: Budget,
): Promise<boolean> {
  const row = await ctx.db
    .query('authRateLimits')
    .withIndex('identifier', (q) => q.eq('identifier', identifier))
    .unique()
  if (row === null) return true
  if (budget.left <= 0) return false
  await ctx.db.delete(row._id)
  budget.left -= 1
  return true
}

/**
 * Les tables possédées par un compte, et ce que chacune emporte.
 *
 * Un enregistrement plutôt qu'un tableau de noms : chaque valeur reste
 * entièrement typée sur sa table et son index, et les clés sont la liste que le
 * test compare au schéma. Un tableau de chaînes aurait demandé de retrouver
 * l'index à la main, donc de le recopier.
 */
const IDENTITY_PURGES = {
  /** Les sessions, et les jetons de rafraîchissement qui en dépendent. */
  authSessions: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const sessions = await ctx.db
        .query('authSessions')
        .withIndex('userId', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (sessions.length === 0) return

      for (const session of sessions) {
        if (!(await drainRefreshTokens(ctx, session._id, budget))) return
        if (!(await drainVerifiers(ctx, session._id, budget))) return
        if (budget.left <= 0) return
        await ctx.db.delete(session._id)
        budget.left -= 1
      }
    }
  },

  /** Les comptes d'authentification, et les codes de vérification en attente. */
  authAccounts: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const accounts = await ctx.db
        .query('authAccounts')
        .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (accounts.length === 0) return

      for (const account of accounts) {
        if (!(await drainVerificationCodes(ctx, account._id, budget))) return
        if (!(await deleteAuthRateLimit(ctx, account._id, budget))) return
        if (budget.left <= 0) return
        await ctx.db.delete(account._id)
        budget.left -= 1
      }
    }
  },
} satisfies Record<string, Purge>

const DATA_PURGES = {
  /** Checkout fences are normally expired before admission; purge is the backstop. */
  billingCheckoutFences: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const rows = await ctx.db
        .query('billingCheckoutFences')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (rows.length === 0) return
      for (const row of rows) {
        await ctx.db.delete(row._id)
        budget.left -= 1
      }
    }
  },

  /** The retained upload generation belongs to the account and leaves with it. */
  cloudDataStates: async (ctx, userId, budget) => {
    const row = await ctx.db
      .query('cloudDataStates')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (!row || budget.left <= 0) return
    await ctx.db.delete(row._id)
    budget.left -= 1
  },

  /** Une remise à zéro Cloud interrompue ne survit pas à la suppression du compte. */
  cloudDataClearJobs: async (ctx, userId, budget) => {
    const row = await ctx.db
      .query('cloudDataClearJobs')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()
    if (!row || budget.left <= 0) return
    await ctx.db.delete(row._id)
    budget.left -= 1
  },

  /** Les binaires : le fichier d'abord, la ligne ensuite. */
  assets: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const assets = await ctx.db
        .query('assets')
        .withIndex('by_user_asset', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (assets.length === 0) return

      let progressed = false
      for (const asset of assets) {
        /* La ligne ne part que si le fichier est parti : la supprimer d'abord
           laisserait un octet facturé que plus rien ne désigne. */
        if (!(await forget(ctx, asset.storageId, budget, { table: 'assets', id: asset._id }))) {
          continue
        }
        await ctx.db.delete(asset._id)
        budget.left -= 1
        progressed = true
      }
      /* Aucun fichier n'a cédé : relire le même lot indéfiniment ne changerait
         rien, et la passe doit rendre la main pour que le cron réessaie. */
      if (!progressed) return
    }
  },

  /** Les projets : leur blob JSON, puis leur ligne. */
  projects: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const projects = await ctx.db
        .query('projects')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (projects.length === 0) return

      let progressed = false
      for (const project of projects) {
        if (!(await forget(ctx, project.blobId, budget, { table: 'projects', id: project._id }))) {
          continue
        }
        await ctx.db.delete(project._id)
        budget.left -= 1
        progressed = true
      }
      if (!progressed) return
    }
  },

  /** Le miroir des droits. Une seule ligne, mais la boucle est la même. */
  entitlements: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const rows = await ctx.db
        .query('entitlements')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (rows.length === 0) return
      for (const row of rows) {
        await ctx.db.delete(row._id)
        budget.left -= 1
      }
    }
  },

  /** La préférence de compte. Une seule ligne, supprimée avec le reste. */
  userSettings: async (ctx, userId, budget) => {
    while (budget.left > 0) {
      const rows = await ctx.db
        .query('userSettings')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .take(Math.min(BATCH, budget.left))
      if (rows.length === 0) return
      for (const row of rows) {
        await ctx.db.delete(row._id)
        budget.left -= 1
      }
    }
  },
} satisfies Record<string, Purge>

/**
 * La liste, et la seule.
 *
 * L'ordre compte : l'identité part avant les données, comme
 * `auth.admin.deleteUser` partait avant la purge du dossier Storage. C'est ce
 * qui fait qu'une suppression interrompue laisse un compte sans porte d'entrée
 * plutôt qu'un compte entier sans ses fichiers.
 */
export const TABLES_OWNED_BY_USER: readonly string[] = [
  ...Object.keys(IDENTITY_PURGES),
  ...Object.keys(DATA_PURGES),
]

/**
 * La table que le balayage ne balaie pas, et pourquoi.
 *
 * Elle porte un `userId` comme les autres et n'est pourtant pas possédée par le
 * compte : elle est ce qui dit que le compte n'a pas fini d'être supprimé.
 * Déclarée ici pour que le test du schéma ait une exception nommée plutôt
 * qu'une case à cocher.
 */
export const TABLES_OUTLIVING_THE_USER: readonly string[] = ['accountDeletionJobs']

type DeletionProgress = 'deleted' | 'cleanup-pending' | 'deletion-pending' | 'billing-active'

export type AccountDeletionOutcome = DeletionProgress

/** Local-first deployments intentionally omit PostHog altogether. */
function posthogDisabled(): boolean {
  return ![env.POSTHOG_HOST, env.POSTHOG_PERSON_API_KEY, env.POSTHOG_PROJECT_ID].some((value) =>
    value?.trim(),
  )
}

async function billingPreventsDeletion(ctx: MutationCtx, userId: Id<'users'>): Promise<boolean> {
  const entitlement = await ctx.db
    .query('entitlements')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
  /* `cloudStatus` comes from Polar's activeSubscriptions collection. Its
     presence, not our wall clock, says that a renewable relationship still
     exists. A stale past period must therefore fail closed until Polar sends a
     customer state with no active Cloud subscription. */
  if (
    entitlement !== null &&
    entitlement.polarCustomerId !== null &&
    entitlement.cloudStatus !== null
  ) {
    return true
  }

  const now = Date.now()
  let pending = false
  for await (const fence of ctx.db
    .query('billingCheckoutFences')
    .withIndex('by_user', (q) => q.eq('userId', userId))) {
    if (fence.expiresAt !== null && fence.expiresAt <= now) await ctx.db.delete(fence._id)
    else pending = true
  }
  return pending
}

async function jobFor(
  ctx: MutationCtx,
  userId: string,
): Promise<Doc<'accountDeletionJobs'> | null> {
  return await ctx.db
    .query('accountDeletionJobs')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()
}

/**
 * Une passe, et ce qu'elle laisse derrière elle.
 *
 * Elle est appelée par la demande de l'utilisateur comme par le cron, dans la
 * même transaction que son appelant : c'est une fonction TypeScript et non un
 * `runMutation`, parce qu'un compte ordinaire tient dans une passe et qu'il n'y
 * a alors rien à planifier du tout.
 */
async function advance(
  ctx: MutationCtx,
  job: Doc<'accountDeletionJobs'>,
): Promise<DeletionProgress> {
  if (job.status === 'telemetry') {
    if (posthogDisabled()) {
      await ctx.db.delete(job._id)
      return 'deleted'
    }
    await ctx.scheduler.runAfter(0, internal.posthog.deletePerson, { userId: job.userId })
    return 'cleanup-pending'
  }

  const userId = ctx.db.normalizeId('users', job.userId)
  if (userId === null) {
    /* Une ligne dont l'identifiant n'a jamais été un `Id<'users'>` ne désigne
       rien à nettoyer, et la garder ferait tourner le cron pour toujours. */
    await ctx.db.delete(job._id)
    return 'deleted'
  }

  /* Re-evaluate on every prepared pass, not only at initial admission. A
     signed Polar update can land while a bounded identity purge is queued. */
  if (job.status === 'prepared' && (await billingPreventsDeletion(ctx, userId))) {
    await ctx.db.delete(job._id)
    return 'billing-active'
  }

  const budget: Budget = { left: PASS_BUDGET, failures: [] }

  if (job.status === 'prepared') {
    for (const purge of Object.values(IDENTITY_PURGES)) await purge(ctx, userId, budget)
    if (budget.left <= 0) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
      return 'deletion-pending'
    }
    const identity = await ctx.db.get(userId)
    if (identity !== null) {
      const email = identity.email ? normalizeEmail(identity.email) : undefined
      if (email && !(await deleteAuthRateLimit(ctx, email, budget))) {
        await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
        return 'deletion-pending'
      }
      await resetAccountLimits(ctx, userId, email)
      if (budget.left <= 0) {
        await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
        return 'deletion-pending'
      }
      await ctx.db.delete(userId)
      budget.left -= 1
    }
    await ctx.db.patch(job._id, { status: 'cleanup', lastError: null })
  }

  for (const purge of Object.values(DATA_PURGES)) await purge(ctx, userId, budget)

  if (budget.failures.length > 0) {
    /* Écrit, pas levé : lever annulerait la transaction, donc tout ce que cette
       passe a réellement supprimé. Un nettoyage à moitié fait reste un
       nettoyage en cours. */
    await ctx.db.patch(job._id, {
      attempts: job.attempts + 1,
      lastError: budget.failures[0] ?? null,
    })
    console.error('Account deletion cleanup remains queued.', {
      userId: job.userId,
      failures: budget.failures.length,
    })
    return 'cleanup-pending'
  }

  if (budget.left <= 0) {
    await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
    return 'cleanup-pending'
  }

  if (posthogDisabled()) {
    await ctx.db.delete(job._id)
    return 'deleted'
  }

  await ctx.db.patch(job._id, { status: 'telemetry', lastError: null })
  await ctx.scheduler.runAfter(0, internal.posthog.deletePerson, { userId: job.userId })
  return 'cleanup-pending'
}

/**
 * La demande, telle que l'utilisateur la fait.
 *
 * Jamais de `userId` en argument : « aucune route ne lit d'identité ailleurs
 * que dans le jeton, c'est la seule forme qui rend impossible d'agir au nom
 * d'un autre en changeant un champ ». La barrière est écrite avant tout le
 * reste, dans la même transaction : dès qu'elle existe, `requireCloud` refuse
 * toute écriture, y compris un envoi de fichier déjà en vol.
 */
export const requestAccountDeletion = mutation({
  args: {},
  returns: v.union(
    v.literal('deleted'),
    v.literal('cleanup-pending'),
    v.literal('deletion-pending'),
    v.literal('billing-active'),
  ),
  handler: async (ctx): Promise<AccountDeletionOutcome> => {
    const userId = await requireUser(ctx)
    /* Ne jamais effacer la seule identité qui peut encore ouvrir le portail et
       résilier un abonnement Polar en cours. Un grant complimentary n'a pas de
       facturation à abandonner et ne passe donc pas par ce verrou. */
    if (await billingPreventsDeletion(ctx, userId)) {
      const existing = await jobFor(ctx, userId)
      if (existing) await ctx.db.delete(existing._id)
      return 'billing-active'
    }
    /* Geste irréversible, et chaque tentative relance un cycle de nettoyage. */
    await consume(ctx, 'accountDeletion', userId)

    /* Une demande qui arrive sur un nettoyage en cours ne le réinitialise pas :
       `attempts` et `lastError` racontent ce qui résiste, et les remettre à zéro
       effacerait la seule trace de ce qui ne passe pas. */
    const existing = await jobFor(ctx, userId)
    const job =
      existing ??
      (await ctx.db
        .insert('accountDeletionJobs', {
          userId,
          status: 'prepared',
          attempts: 0,
          lastError: null,
        })
        .then((id) => ctx.db.get(id)))
    if (job === null) throw new Error('Could not open the account deletion job.')

    return await advance(ctx, job)
  },
})

/** La reprise d'un compte, par le cron ou par une passe qui a rendu la main. */
export const resume = internalMutation({
  args: { userId: v.string() },
  returns: v.union(
    v.literal('deleted'),
    v.literal('cleanup-pending'),
    v.literal('deletion-pending'),
    v.literal('billing-active'),
  ),
  handler: async (ctx, args): Promise<DeletionProgress> => {
    const job = await jobFor(ctx, args.userId)
    /* Plus de ligne : le travail est fini, et c'est le seul endroit qui le dit. */
    return job === null ? 'deleted' : await advance(ctx, job)
  },
})

/**
 * Le tour du cron.
 *
 * Convex garantit qu'au plus une exécution d'un cron tourne à un instant donné,
 * ce qui remplace le drapeau `running` du worker Node. Chaque compte est repris
 * dans sa propre mutation : une file de dix comptes ne doit pas tenir dans une
 * seule transaction, et un compte qui résiste ne doit pas empêcher les neuf
 * autres d'avancer.
 */
export const resumeAll = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const jobs = await ctx.db.query('accountDeletionJobs').take(BATCH)
    for (const job of jobs) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
    }
    return jobs.length
  },
})

const posthogDeletionOutcome = v.union(
  v.literal('deleted'),
  v.literal('absent'),
  v.literal('configuration'),
  v.literal('invalid-response'),
  v.literal('network'),
  v.literal('rate-limited'),
  v.literal('service-unavailable'),
  v.literal('unauthorized'),
)

/** A PostHog acknowledgement is the final durable deletion checkpoint. */
export const finishTelemetry = internalMutation({
  args: { userId: v.string(), outcome: posthogDeletionOutcome },
  returns: v.null(),
  handler: async (ctx, { userId, outcome }) => {
    const job = await jobFor(ctx, userId)
    if (job === null || job.status !== 'telemetry') return null

    if (outcome === 'deleted' || outcome === 'absent') {
      await ctx.db.delete(job._id)
      return null
    }

    await ctx.db.patch(job._id, {
      attempts: job.attempts + 1,
      lastError: `posthog:${outcome}`,
    })
    console.error('PostHog person deletion remains queued.', { outcome })
    return null
  },
})

/** Bounded operator/test proof that no child survived a deleted session. */
export const inspectSessionCleanup = internalQuery({
  args: { sessionId: v.id('authSessions') },
  returns: v.object({ session: v.boolean(), refreshToken: v.boolean(), verifier: v.boolean() }),
  handler: async (ctx, { sessionId }) => {
    const [session, refreshToken, verifier] = await Promise.all([
      ctx.db.get(sessionId),
      ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
        .first(),
      ctx.db
        .query('authVerifiers')
        .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
        .first(),
    ])
    return {
      session: session !== null,
      refreshToken: refreshToken !== null,
      verifier: verifier !== null,
    }
  },
})
