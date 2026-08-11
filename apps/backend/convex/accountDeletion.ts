import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation, type MutationCtx } from './_generated/server'
import { requireUser } from './authz'
import { consume } from './limits'

/**
 * La suppression de compte, sans cascade.
 *
 * `apps/api` s'appuyait sur une phrase de Postgres : « une seule instruction
 * suffit, `auth.users` est référencée en `on delete cascade` par `projects` et
 * `entitlements` ». Elle nommait aussi le risque qu'elle évitait — « supprimer
 * table par table recréerait la même chaîne en TypeScript, avec le risque
 * qu'une table ajoutée demain n'y soit jamais inscrite ».
 *
 * Convex n'a pas de cascade : ce risque devient réel, et il ne se tient pas en
 * s'en souvenant. Deux mesures, et elles vont ensemble. La liste vit ici et
 * nulle part ailleurs — ce sont les clés de `IDENTITY_PURGES` et de
 * `DATA_PURGES`, réunies dans `TABLES_OWNED_BY_USER`. Et
 * `accountDeletion.test.ts` énumère le schéma : toute table portant un champ
 * `userId` doit être dans cette liste, ou être l'exception déclarée
 * (`accountDeletionJobs`, qui survit exprès au compte). C'est ce test qui
 * remplace le `cascade`, et c'est lui qui attrapera la table ajoutée demain.
 *
 * Le nom du fichier n'est pas en `kebab-case` comme le reste du dépôt, et ce
 * n'est pas un oubli : Convex refuse la poussée d'un module dont le chemin
 * porte un tiret (« can only contain alphanumeric characters, underscores, or
 * periods »). Il suit donc le nom sous lequel les fonctions s'appellent,
 * `internal.accountDeletion.*`.
 *
 * La machine à états, elle, se transpose sans se repenser : idempotente,
 * sérialisée par compte, et posant sa barrière durable **avant** toute opération
 * irréversible. Ce qui change vraiment est la nature de l'ambiguïté. Chez
 * Supabase, `auth.admin.deleteUser` était un appel réseau dont la réponse
 * pouvait se perdre après coup, d'où trois états d'identité — présente, absente,
 * inconnue. Ici l'identité se supprime dans la même transaction que le reste :
 * elle est là ou elle n'est plus, et il n'y a pas de troisième cas à
 * réconcilier. L'ambiguïté qui reste est entre le navigateur et le déploiement,
 * et c'est `'unknown'`, côté client, qui la porte — comme avant.
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
 */
async function forget(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  budget: Budget,
): Promise<boolean> {
  try {
    await ctx.storage.delete(storageId)
    return true
  } catch (error) {
    budget.failures.push(message(error))
    return false
  }
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
        const tokens = await ctx.db
          .query('authRefreshTokens')
          .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
          .take(Math.min(BATCH, budget.left))
        for (const token of tokens) {
          await ctx.db.delete(token._id)
          budget.left -= 1
        }
        /* Budget épuisé par les enfants : la session reste, et c'est voulu —
           un jeton non supprimé pointerait sinon sur une session disparue. La
           passe suivante reprendra la même session. */
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
        const codes = await ctx.db
          .query('authVerificationCodes')
          .withIndex('accountId', (q) => q.eq('accountId', account._id))
          .take(Math.min(BATCH, budget.left))
        for (const code of codes) {
          await ctx.db.delete(code._id)
          budget.left -= 1
        }
        if (budget.left <= 0) return
        await ctx.db.delete(account._id)
        budget.left -= 1
      }
    }
  },
} satisfies Record<string, Purge>

const DATA_PURGES = {
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
        if (!(await forget(ctx, asset.storageId, budget))) continue
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
        if (!(await forget(ctx, project.blobId, budget))) continue
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

export type AccountDeletionOutcome = 'deleted' | 'cleanup-pending' | 'deletion-pending'

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
): Promise<AccountDeletionOutcome> {
  const userId = ctx.db.normalizeId('users', job.userId)
  if (userId === null) {
    /* Une ligne dont l'identifiant n'a jamais été un `Id<'users'>` ne désigne
       rien à nettoyer, et la garder ferait tourner le cron pour toujours. */
    await ctx.db.delete(job._id)
    return 'deleted'
  }

  const budget: Budget = { left: PASS_BUDGET, failures: [] }

  if (job.status === 'prepared') {
    for (const purge of Object.values(IDENTITY_PURGES)) await purge(ctx, userId, budget)
    if (budget.left <= 0) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.resume, { userId: job.userId })
      return 'deletion-pending'
    }
    const identity = await ctx.db.get(userId)
    if (identity !== null) await ctx.db.delete(userId)
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

  await ctx.db.delete(job._id)
  return 'deleted'
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
  ),
  handler: async (ctx): Promise<AccountDeletionOutcome> => {
    const userId = await requireUser(ctx)
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
  ),
  handler: async (ctx, args): Promise<AccountDeletionOutcome> => {
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
