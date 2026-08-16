/**
 * Les gestes d'authentification, publiés hors de React.
 *
 * Convex Auth n'expose ses actions que par un hook, et l'application les appelle
 * depuis des endroits qui ne sont pas des composants : `lib/auth.ts`, la palette
 * de commandes, le store de session. Plutôt que de faire remonter un contexte
 * React jusqu'à eux — ce qui obligerait à envelopper tout l'arbre et à le
 * remonter dès que le client arrive — un pont minuscule publie les actions ici,
 * et tout le monde les lit au même endroit.
 *
 * Conséquence voulue : l'arbre de l'éditeur est exactement celui d'aujourd'hui.
 * Le fournisseur n'entoure qu'un composant qui ne rend rien, monté en frère de
 * `App`, donc l'ouverture d'une session ne remonte jamais le canvas.
 */
import type { Value } from 'convex/values'

export interface AuthActions {
  signIn: (
    provider: string,
    params?: Record<string, Value> & { redirectTo?: string },
  ) => Promise<{ signingIn: boolean; redirect?: URL }>
  signOut: () => Promise<void>
}

let actions: AuthActions | null = null
let announce: ((value: AuthActions) => void) | null = null

/** Résolue à la première publication, et jamais rejetée. */
const ready = new Promise<AuthActions>((resolve) => {
  announce = resolve
})

export function publishAuthActions(next: AuthActions): void {
  actions = next
  announce?.(next)
  announce = null
}

/**
 * Les actions, dès qu'elles existent.
 *
 * L'attente est réelle : entre le clic sur « Se connecter » et le montage du
 * pont il y a un `import()`. Rendre `null` obligerait chaque appelant à
 * réessayer, ce qui ferait trois politiques d'attente pour un seul cas.
 */
export function authActions(): Promise<AuthActions> {
  return actions ? Promise.resolve(actions) : ready
}
