import { describe, expect, it } from 'vitest'
import { ConvexError } from 'convex/values'
import { readable } from '@/lib/auth'

/**
 * Ce que l'utilisateur lit quand la connexion refuse.
 *
 * Le serveur parle en codes — `RATE_LIMITED` pour nos compteurs,
 * `TooManyFailedAttempts` pour ceux de Convex Auth — et aucun de ces mots n'a
 * sa place dans une interface. Ces cas existent parce que la traduction est la
 * seule chose que le backend ne peut pas vérifier lui-même.
 */
describe('le message montré à la place de l’erreur brute', () => {
  it('traduit un compteur dépassé côté ScreenForge', () => {
    const refus = new ConvexError({ code: 'RATE_LIMITED', retryAfter: 1200 })
    expect(readable(refus).message).toBe('Trop de tentatives. Réessayez dans un instant.')
  })

  it('traduit le plafond d’essais de Convex Auth', () => {
    expect(
      readable(new Error('[Request ID: abc] Server Error: TooManyFailedAttempts')).message,
    ).toBe('Trop de tentatives. Réessayez dans un instant.')
  })

  it('ne confond pas un mauvais secret avec un plafond', () => {
    expect(readable(new Error('InvalidSecret')).message).toBe(
      'Adresse e-mail ou mot de passe incorrect.',
    )
  })

  it('ne laisse jamais passer un message de serveur inconnu', () => {
    const brut = 'Uncaught Error at convex/auth.ts:41 — JWT_PRIVATE_KEY missing'
    expect(readable(new Error(brut)).message).toBe('La connexion a échoué. Réessayez.')
  })
})
