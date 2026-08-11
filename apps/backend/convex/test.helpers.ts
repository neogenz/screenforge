/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import rateLimiter from '@convex-dev/rate-limiter/test'
import schema from './schema'

/**
 * Le déploiement, simulé, avec ses composants.
 *
 * `convex-test` ne lit pas `convex.config.ts` : un composant absent du
 * simulateur fait échouer chaque appel qui le touche, ce qui ressemble à un bug
 * du code testé. Il s'enregistre donc ici, une fois, pour toute la suite.
 *
 * Ce que ce simulateur **ne** vérifie pas est écrit dans `phase-6.md` : ni les
 * plafonds de taille des documents, ni l'exécution des crons, ni les messages
 * du vrai moteur. Ces trois-là se constatent contre un déploiement réel.
 */
export function testConvex() {
  const t = convexTest(schema, import.meta.glob('./**/*.ts'))
  rateLimiter.register(t)
  return t
}

/**
 * Un compte qui a le droit d'écrire dans le nuage.
 *
 * Le miroir est posé à la main plutôt que par le webhook : la phase 4 n'a pas
 * encore basculé, et ce que ces suites vérifient est ce qui se passe **après**
 * le portillon, pas le portillon lui-même — `authz.test.ts` s'en charge.
 */
export async function cloudAccount(t: ReturnType<typeof testConvex>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert('users', {})
    await ctx.db.insert('entitlements', {
      userId,
      polarCustomerId: `cus_${userId}`,
      licenceGrantedAt: '2026-03-12T09:00:00.000Z',
      cloudStatus: 'active',
      cloudPeriodEnd: '2099-01-01T00:00:00.000Z',
      sourceUpdatedAt: null,
    })
    return userId
  })
}

/**
 * Le refus d'un compteur, reconnu à son code et non à sa classe.
 *
 * `error instanceof ConvexError` est faux ici : l'erreur traverse la frontière
 * action/mutation du simulateur, qui la reconstruit à partir de sa forme
 * sérialisée. C'est justement la garantie qui compte — le code voyage, la classe
 * non — et c'est aussi ce que le navigateur recevra.
 */
export function rateLimited(error: unknown): boolean {
  return errorCode(error) === 'RATE_LIMITED'
}

/** Le code porté par un `ConvexError`, quelle que soit la forme qui a survécu. */
export function errorCode(error: unknown): string | null {
  const direct: unknown = (error as { data?: unknown })?.data
  if (typeof direct === 'object' && direct !== null) {
    return (direct as { code?: string }).code ?? null
  }
  try {
    const parsed: unknown = JSON.parse(String((error as { message?: string })?.message ?? ''))
    return typeof parsed === 'object' && parsed !== null
      ? ((parsed as { code?: string }).code ?? null)
      : null
  } catch {
    return null
  }
}
