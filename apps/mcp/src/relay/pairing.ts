import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const PAIRING_CODE_TTL_MS = 5 * 60_000
export const PAIRING_ATTEMPT_WINDOW_MS = 10 * 60_000
export const MAX_PAIRING_ATTEMPTS = 5

export interface PairingOptions {
  now?: () => number
  mintToken?: () => string
  mintCode?: () => string
  announce?: (code: string, expiresAt: number) => void
}

export function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

const mintCode = () => randomInt(0, 1_000_000).toString().padStart(6, '0')

/** Autorité éphémère du relais : code usage unique puis bearer en mémoire. */
export class Pairing {
  token: string
  version = 1
  readonly #now: () => number
  readonly #mintToken: () => string
  readonly #mintCode: () => string
  readonly #announce: (code: string, expiresAt: number) => void
  #code = ''
  #expiresAt = 0
  #attempts = 0
  #windowStartedAt = 0

  constructor(options: PairingOptions = {}) {
    this.#now = options.now ?? Date.now
    this.#mintToken = options.mintToken ?? mintToken
    this.#mintCode = options.mintCode ?? mintCode
    this.#announce = options.announce ?? (() => {})
    this.token = this.#mintToken()
    this.#rotateCode()
  }

  /** Rend un bearer neuf uniquement contre le code courant, une seule fois. */
  pair(presented: string): string | null {
    const now = this.#now()
    if (now - this.#windowStartedAt >= PAIRING_ATTEMPT_WINDOW_MS) {
      this.#windowStartedAt = now
      this.#attempts = 0
    }
    if (now >= this.#expiresAt) this.#rotateCode()
    if (this.#attempts >= MAX_PAIRING_ATTEMPTS || !equal(this.#code, presented)) {
      this.#attempts += 1
      return null
    }
    this.#attempts = 0
    this.#windowStartedAt = now
    this.token = this.#mintToken()
    this.version += 1
    this.#rotateCode()
    return this.token
  }

  /** Invalide immédiatement bearer et code, puis annonce la prochaine preuve. */
  revoke(): void {
    this.token = this.#mintToken()
    this.version += 1
    this.#attempts = 0
    this.#windowStartedAt = this.#now()
    this.#rotateCode()
  }

  #rotateCode(): void {
    let next = this.#mintCode()
    for (let retry = 0; next === this.#code && retry < 8; retry += 1) next = this.#mintCode()
    if (next === this.#code) throw new Error('PAIRING_CODE_ROTATION_FAILED')
    this.#code = next
    this.#expiresAt = this.#now() + PAIRING_CODE_TTL_MS
    this.#announce(this.#code, this.#expiresAt)
  }
}

/** Comparaison à durée constante, y compris quand les longueurs diffèrent. */
function equal(expected: string, presented: string): boolean {
  const given = Buffer.alloc(expected.length)
  Buffer.from(presented).copy(given, 0, 0, expected.length)
  return timingSafeEqual(Buffer.from(expected), given) && presented.length === expected.length
}

export function createPairing(options?: PairingOptions): Pairing {
  return new Pairing(options)
}

export function verifyToken(pairing: Pairing, presented: string | undefined): boolean {
  return presented !== undefined && equal(pairing.token, presented)
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …`. */
export function bearer(header: string | null | undefined): string | undefined {
  if (!header) return undefined
  const [scheme, value] = header.split(' ')
  return scheme === 'Bearer' && value ? value : undefined
}
