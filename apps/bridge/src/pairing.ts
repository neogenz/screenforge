import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * L'appairage : un secret par capacité, en mémoire, jamais sur le disque.
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
 *
 * **Un jeton par capacité, et c'est la différence qui compte.** Le pont fait
 * deux choses sans rapport : parler à un modèle, et publier un lot chez Apple.
 * Les deux n'exigent pas la même confiance — le premier ne reçoit aucune image,
 * le second reçoit tout le lot rendu et lance un téléversement irréversible.
 * Un jeton unique aurait fait de l'appairage à un assistant une autorisation de
 * publier. Ici, refuser une capacité est un geste : on ne recopie pas son jeton.
 *
 * La capacité s'appelle `assistant` plutôt que d'après un binaire : elle ouvre
 * le droit de faire écrire un texte par le moteur confiné installé.
 */

export const BRIDGE_CAPABILITIES = ['assistant', 'asc-publish'] as const

export type BridgeCapability = (typeof BRIDGE_CAPABILITIES)[number]

export interface Grant {
  token: string
  version: number
}

export type Pairing = Record<BridgeCapability, Grant>

export function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

export function createPairing(): Pairing {
  return {
    assistant: { token: mintToken(), version: 1 },
    'asc-publish': { token: mintToken(), version: 1 },
  }
}

/** Révoque une seule capacité : l'autre garde son jeton et sa version. */
export function revoke(pairing: Pairing, capability: BridgeCapability): Pairing {
  return {
    ...pairing,
    [capability]: { token: mintToken(), version: pairing[capability].version + 1 },
  }
}

/**
 * Comparaison à durée constante : deux jetons de longueurs différentes sont
 * refusés avant `timingSafeEqual`, qui lève sur des tampons inégaux.
 *
 * Le jeton d'une capacité ne vaut jamais pour l'autre : c'est le seul endroit
 * qui le décide, et il ne regarde qu'une entrée.
 */
export function verifyToken(
  pairing: Pairing,
  capability: BridgeCapability,
  presented: string | undefined,
): boolean {
  if (!presented) return false
  const expected = Buffer.from(pairing[capability].token)
  const given = Buffer.from(presented)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …`. */
export function bearer(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  const [scheme, value] = header.split(' ')
  return scheme === 'Bearer' && value ? value : undefined
}

export function tokenVersions(pairing: Pairing): Record<BridgeCapability, number> {
  return { assistant: pairing.assistant.version, 'asc-publish': pairing['asc-publish'].version }
}
