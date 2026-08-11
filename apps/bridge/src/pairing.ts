import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * L'appairage : un secret en mémoire, jamais sur le disque.
 *
 * Le jeton est tiré au démarrage, affiché une fois, et meurt avec le processus.
 * Rien ne l'écrit dans un fichier de configuration, un `localStorage` ou un
 * journal — un secret écrit quelque part est un secret qu'une sauvegarde, une
 * synchronisation ou un rapport d'erreur finit par emporter. Le prix est que
 * l'utilisateur le recopie à chaque démarrage du pont ; c'est le bon prix pour
 * une clé qui ouvre un processus sur sa machine.
 *
 * Il est versionné : révoquer incrémente la version et en tire un nouveau, donc
 * un jeton recopié ailleurs cesse de valoir au moment exact où on le révoque,
 * sans redémarrer quoi que ce soit.
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

export function revoke(pairing: Pairing): Pairing {
  return { token: mintToken(), version: pairing.version + 1 }
}

/**
 * Comparaison à durée constante : deux jetons de longueurs différentes sont
 * refusés avant `timingSafeEqual`, qui lève sur des tampons inégaux.
 */
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
