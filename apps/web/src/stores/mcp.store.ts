import { create } from 'zustand'

/**
 * L'état de la liaison avec le démon MCP, et rien d'autre.
 *
 * Ce qu'on n'y trouve pas est aussi décidé que ce qu'on y trouve : **le jeton
 * n'est pas ici**. Il vit dans une variable de module de `lib/mcp/client.ts`,
 * pour la raison qui l'y garde aussi côté pont — un store Zustand se persiste,
 * s'inspecte depuis la console et part dans les captures d'état. Ce store est
 * lisible par `__sfStores` en développement ; y poser une clé qui commande un
 * processus de la machine serait l'exposer à tout ce qui lit la page.
 *
 * Le socket non plus n'est pas ici : le store décrit, il ne branche pas.
 * `enable()` / `disable()` sont dans le client, seul propriétaire du flux — un
 * store qui ouvrirait une connexion importerait le client, que le client
 * importe déjà.
 */

/** `off` est le mode par défaut du produit, pas une panne : rien n'est branché. */
export type McpStatus = 'off' | 'connecting' | 'live' | 'error'
export type McpConnectionStep = 'daemon' | 'editor' | 'ready'
export type McpStepStatus = 'waiting' | 'active' | 'done' | 'error'

/** Le même fait en toutes lettres : infobulle, ligne de statut, nom accessible. */
export const MCP_LABELS: Record<McpStatus, string> = {
  off: 'Inactive',
  connecting: 'Connexion…',
  live: 'Connectée',
  error: 'Injoignable',
}

export interface McpState {
  status: McpStatus
  connectionStep: McpConnectionStep
  daemonVersion: string
  /**
   * Une phrase que l'utilisateur peut suivre, jamais une trace. Vide hors
   * erreur : elle survivrait autrement à la reconnexion qui l'a réparée.
   */
  message: string
  /**
   * Le choix, mémorisé — distinct du statut, qui est le résultat de ce choix.
   * Un démon éteint laisse `enabled` vrai et `status` en erreur, et c'est bien
   * ce qu'il faut : le mode reste demandé, c'est la liaison qui manque.
   */
  enabled: boolean
  /**
   * Ce que l'agent a effectivement posé, pour que la boîte prouve qu'elle vit.
   * Un statut « connecté » ne dit pas si quoi que ce soit est arrivé.
   */
  appliedBatches: number
  appliedCalls: number

  setStatus: (status: McpStatus, message?: string) => void
  setConnectionStep: (step: McpConnectionStep) => void
  setDaemonVersion: (version: string) => void
  setEnabled: (enabled: boolean) => void
  noteBatch: (calls: number) => void
}

export const useMcpStore = create<McpState>()((set) => ({
  status: 'off',
  connectionStep: 'daemon',
  daemonVersion: '',
  message: '',
  enabled: false,
  appliedBatches: 0,
  appliedCalls: 0,

  setStatus: (status, message = '') => set({ status, message }),

  setConnectionStep: (connectionStep) => set({ connectionStep }),

  setDaemonVersion: (daemonVersion) => set({ daemonVersion }),

  setEnabled: (enabled) => set({ enabled }),

  noteBatch: (calls) =>
    set((state) => ({
      appliedBatches: state.appliedBatches + 1,
      appliedCalls: state.appliedCalls + calls,
    })),
}))

/** Projette le cycle observable sur les quatre états visuels du parcours. */
export function projectMcpSteps(
  status: McpStatus,
  current: McpConnectionStep,
): Record<McpConnectionStep, McpStepStatus> {
  const steps: McpConnectionStep[] = ['daemon', 'editor', 'ready']
  const currentIndex = steps.indexOf(current)
  return Object.fromEntries(
    steps.map((step, index) => [
      step,
      index < currentIndex
        ? 'done'
        : index > currentIndex
          ? 'waiting'
          : status === 'error'
            ? 'error'
            : 'active',
    ]),
  ) as Record<McpConnectionStep, McpStepStatus>
}
