import { randomUUID } from 'node:crypto'
import type { ToolCall } from '@screenforge/project-format'
import type { RelayRequest, RelayResult } from './protocol.ts'

/**
 * L'éditeur connecté, les lots qui l'attendent, et l'état qu'il a poussé.
 *
 * Un seul onglet à la fois, et le dernier arrivé évince le précédent. Deux
 * onglets branchés en même temps recevraient chacun la moitié des lots, au
 * hasard de la boucle d'événements, et l'agent verrait un projet qui se
 * contredit d'un appel à l'autre. Évincer est brutal et lisible ; partager ne
 * l'est pas.
 *
 * Rien n'attend indéfiniment. Un onglet fermé, un rechargement, un écran de
 * veille : l'agent qui a demandé quelque chose doit recevoir une erreur qui
 * nomme la cause, pas une promesse qui ne revient jamais — un appel d'outil
 * suspendu bloque le tour entier de l'agent.
 */

const CALL_TIMEOUT_MS = 60_000

/** L'éditeur n'est pas là : l'agent doit ouvrir l'app, pas réessayer. */
export class AppUnavailableError extends Error {
  constructor(
    message = 'Aucun éditeur ScreenForge connecté. Ouvrez l’application et activez « Connexion MCP ».',
  ) {
    super(message)
    this.name = 'AppUnavailableError'
  }
}

/** L'appel est parti et n'a pas abouti : la cause dit s'il faut réessayer. */
export class CallFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CallFailedError'
  }
}

export interface AppConnection {
  send: (request: RelayRequest) => void
  close: () => void
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class RelaySession {
  #connection: AppConnection | null = null
  #pending = new Map<string, Pending>()
  #state: unknown = null
  readonly #newId: () => string
  readonly #timeoutMs: number

  constructor(options: { newId?: () => string; timeoutMs?: number } = {}) {
    this.#newId = options.newId ?? randomUUID
    this.#timeoutMs = options.timeoutMs ?? CALL_TIMEOUT_MS
  }

  get connected(): boolean {
    return this.#connection !== null
  }

  /** Le dernier état poussé, ou `null` tant que l'éditeur n'a rien dit. */
  get state(): unknown {
    return this.#state
  }

  /**
   * Branche un éditeur, en évinçant celui qui tenait la place.
   *
   * L'état est oublié à la bascule : le nouvel onglet ouvre peut-être un autre
   * projet, et un état hérité mentirait jusqu'à sa première écriture. Il le
   * repousse dans la foulée, à l'ouverture du flux.
   */
  attach(connection: AppConnection): void {
    const previous = this.#connection
    this.#connection = connection
    this.#state = null
    if (previous) {
      this.#failAll('L’éditeur a été remplacé par un autre onglet ScreenForge.')
      previous.close()
    }
  }

  /**
   * Débranche, mais seulement si c'est bien la connexion en cours.
   *
   * Une connexion évincée nettoie derrière elle après que la nouvelle a pris la
   * place : sans cette garde, ce nettoyage tardif débrancherait l'onglet qui
   * vient d'arriver.
   */
  detach(connection: AppConnection): void {
    if (this.#connection !== connection) return
    this.#connection = null
    this.#state = null
    this.#failAll('L’éditeur ScreenForge s’est déconnecté avant de répondre.')
  }

  pushState(state: unknown): void {
    this.#state = state
  }

  /** Rend `false` si l'identifiant ne correspond à aucun appel en vol. */
  settle(result: RelayResult): boolean {
    const pending = this.#pending.get(result.id)
    if (!pending) return false
    this.#pending.delete(result.id)
    clearTimeout(pending.timer)
    if (result.ok) pending.resolve(result.result ?? null)
    else pending.reject(new CallFailedError(result.error ?? 'Appel refusé par l’éditeur.'))
    return true
  }

  dispatch(calls: ToolCall[]): Promise<unknown> {
    const connection = this.#connection
    if (!connection) return Promise.reject(new AppUnavailableError())
    const id = this.#newId()
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(
          new CallFailedError(
            'L’éditeur n’a pas répondu en 60 s. Le lot n’a peut-être pas été appliqué : relisez l’état avant de rejouer.',
          ),
        )
      }, this.#timeoutMs)
      timer.unref?.()
      this.#pending.set(id, { resolve, reject, timer })
      try {
        connection.send({ id, calls })
      } catch (error) {
        this.#pending.delete(id)
        clearTimeout(timer)
        reject(new CallFailedError(error instanceof Error ? error.message : 'Flux interrompu.'))
      }
    })
  }

  #failAll(reason: string): void {
    const pending = [...this.#pending.values()]
    this.#pending.clear()
    for (const call of pending) {
      clearTimeout(call.timer)
      call.reject(new CallFailedError(reason))
    }
  }
}
