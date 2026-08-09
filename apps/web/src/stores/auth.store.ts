import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import {
  cacheEntitlements,
  fetchEntitlements,
  readCachedEntitlements,
  type Entitlements,
} from '@/lib/entitlements'
import { planName } from '@/lib/plans'
import { getSupabase } from '@/lib/supabase'
import { toast } from '@/stores/toast.store'

/**
 * `unknown` est un état réel, pas une valeur d'attente polie : entre le montage
 * et la première réponse du client, on ne sait pas si l'utilisateur a une
 * session. Afficher « Se connecter » pendant ce temps ferait clignoter le
 * bouton chez quelqu'un qui est déjà connecté.
 */
export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in'

interface AuthState {
  status: AuthStatus
  session: Session | null
  user: User | null
  /**
   * Ce que le compte a acheté, ou `null` tant qu'on ne le sait pas — y compris
   * quand il n'y a pas d'API de vente configurée. Les droits vivent avec la
   * session parce qu'ils s'éteignent avec elle : garder ceux du compte
   * précédent après une déconnexion lèverait le filigrane chez le suivant.
   */
  entitlements: Entitlements | null
  setSession: (session: Session | null) => void
  setEntitlements: (entitlements: Entitlements | null) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  session: null,
  user: null,
  entitlements: null,

  setSession: (session) =>
    set((state) => {
      const user = session?.user ?? null
      const userId = user?.id ?? null
      return {
        session,
        user,
        status: session ? 'signed-in' : 'signed-out',
        entitlements:
          userId === (state.user?.id ?? null)
            ? state.entitlements
            : userId
              ? readCachedEntitlements(userId)
              : null,
      }
    }),

  setEntitlements: (entitlements) =>
    set((state) => {
      if (entitlements && entitlements.userId !== state.user?.id) return state
      if (entitlements) cacheEntitlements(entitlements)
      return { entitlements }
    }),
}))

/**
 * Relit les droits depuis l'API, et les efface quand il n'y a plus de session.
 *
 * Appelé à chaque changement de session, et au retour d'un checkout : le
 * webhook peut arriver après la redirection de Polar, donc l'appelant relance.
 * L'échec n'écrase rien — un réseau coupé ne doit pas retirer une licence.
 */
export async function refreshEntitlements(): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  if (useAuthStore.getState().status !== 'signed-in' || !userId) {
    useAuthStore.getState().setEntitlements(null)
    return
  }
  try {
    const entitlements = await fetchEntitlements()
    if (useAuthStore.getState().user?.id === userId) {
      useAuthStore.getState().setEntitlements(entitlements)
    }
  } catch (error) {
    console.warn('Could not read the account entitlements.', error)
  }
}

/**
 * Branche le store sur le client, et rend son démonteur.
 *
 * Une seule souscription suffit : `onAuthStateChange` émet `INITIAL_SESSION`
 * dès l'abonnement, avec la session restaurée ou `null`. Un `getSession()`
 * préalable ferait le même travail une seconde fois et ouvrirait une fenêtre
 * où les deux réponses peuvent arriver dans le désordre.
 *
 * Sans instance configurée, l'état tombe directement sur `signed-out` : rien
 * n'attend une réponse qui ne viendra pas, et rien du client n'est chargé.
 */
export async function initAuth(): Promise<() => void> {
  const pending = getSupabase()
  if (!pending) {
    useAuthStore.setState({ status: 'signed-out' })
    return () => {}
  }

  const supabase = await pending
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session)
    void refreshEntitlements()
  })

  return () => subscription.unsubscribe()
}

const CHECKOUT_POLL_INTERVAL_MS = 2000
const CHECKOUT_POLL_ATTEMPTS = 10

/**
 * Le retour de Polar, une fois le paiement accepté.
 *
 * Polar renvoie l'acheteur immédiatement ; le webhook qui inscrit le droit
 * arrive par un autre chemin, quelques secondes plus tard. Sans cette attente,
 * l'éditeur se rouvrirait sur le même palier qu'avant l'achat et il faudrait
 * recharger la page pour voir ce qu'on vient de payer.
 *
 * Le paramètre est retiré de l'URL tout de suite : rechargé, il relancerait
 * l'attente sur un achat déjà comptabilisé.
 */
export function consumeCheckoutReturn(): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get('checkout') !== 'success') return

  url.searchParams.delete('checkout')
  window.history.replaceState(null, '', url.toString())
  void pollForPurchase()
}

async function pollForPurchase(): Promise<void> {
  const before = summarize(useAuthStore.getState().entitlements)

  for (let attempt = 0; attempt < CHECKOUT_POLL_ATTEMPTS; attempt += 1) {
    await refreshEntitlements()
    const after = useAuthStore.getState().entitlements
    if (summarize(after) !== before) {
      toast(`Merci — palier ${planName(after)} actif.`, 'success')
      return
    }
    await new Promise((resolve) => setTimeout(resolve, CHECKOUT_POLL_INTERVAL_MS))
  }

  /* Ni un succès ni une erreur : le paiement est passé chez Polar, c'est son
     enregistrement chez nous qui tarde. Dire « échec » ferait payer deux fois. */
  toast('Paiement reçu. L’activation peut prendre une minute.', 'info', { duration: 8000 })
}

function summarize(entitlements: Entitlements | null): string {
  return `${entitlements?.licence ?? false}:${entitlements?.cloud ?? false}`
}
