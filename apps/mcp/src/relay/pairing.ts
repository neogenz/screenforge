import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Un jeton, tiré au démarrage, en mémoire, mort avec le processus.
 *
 * Le pont (`apps/bridge`) fait recopier son jeton à la main parce qu'il ouvre
 * deux capacités de confiance différentes et qu'en refuser une est un geste :
 * on ne recopie pas. Ici il n'y en a qu'une — « écrire dans le projet ouvert »
 * — et le geste qui l'accorde est ailleurs : c'est l'utilisateur qui active le
 * mode MCP dans l'éditeur. La page appelle alors `POST /pair` et reçoit le
 * jeton, sans que personne recopie rien.
 *
 * Ce qui garde cet échange fermé n'est donc pas le secret, c'est l'origine :
 * seule une page servie depuis une origine admise obtient le jeton, et une
 * page hostile ne peut pas mentir sur la sienne. Le jeton sert après, pour que
 * le flux et les réponses ne dépendent pas d'un en-tête que `EventSource` ne
 * sait pas poser.
 */

export interface Pairing {
  token: string
  version: number
}

export function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

export function createPairing(): Pairing {
  return { token: mintToken(), version: 1 }
}

/** Comparaison à durée constante ; `timingSafeEqual` lève sur des tampons inégaux. */
export function verifyToken(pairing: Pairing, presented: string | undefined): boolean {
  if (!presented) return false
  const expected = Buffer.from(pairing.token)
  const given = Buffer.from(presented)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …`. */
export function bearer(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  const [scheme, value] = header.split(' ')
  return scheme === 'Bearer' && value ? value : undefined
}
