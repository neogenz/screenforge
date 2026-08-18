import { create } from 'zustand'
import {
  cacheEntitlements,
  fetchEntitlements,
  readCachedEntitlements,
  type Entitlements,
} from '@/lib/entitlements'
import { planName } from '@/lib/plans'
import { cloudConfigured } from '@/lib/convex'
import { JWT_STORAGE_KEY } from '@/lib/session-keys'
import { toast } from '@/stores/toast.store'

/**
 * `unknown` est un état réel, pas une valeur d'attente polie : entre le montage
 * et la première réponse du client, on ne sait pas si l'utilisateur a une
 * session. Afficher « Se connecter » pendant ce temps ferait clignoter le
 * bouton chez quelqu'un qui est déjà connecté.
 */
export type AuthStatus = 'unknown' | 'signed-out' | 'signed-in'

/** Ce que la chrome affiche d'un compte, et rien de plus. */
export interface CloudUser {
  id: string
  email: string | null
}

interface AuthState {
  status: AuthStatus
  user: CloudUser | null
  /**
   * Ce que le compte a acheté, ou `null` tant qu'on ne le sait pas — y compris
   * quand il n'y a pas d'instance configurée. Les droits vivent avec la
   * session parce qu'ils s'éteignent avec elle : garder ceux du compte
   * précédent après une déconnexion afficherait un abonnement erroné au suivant.
   */
  entitlements: Entitlements | null
  /** Le cache informe hors ligne, mais ne suffit jamais pour démarrer une sync. */
  entitlementsVerified: boolean
  setUser: (user: CloudUser | null) => void
  setEntitlements: (entitlements: Entitlements | null) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  entitlements: null,
  entitlementsVerified: false,

  setUser: (user) =>
    set((state) => {
      const userId = user?.id ?? null
      return {
        user,
        status: user ? 'signed-in' : 'signed-out',
        entitlements:
          userId === (state.user?.id ?? null)
            ? state.entitlements
            : userId
              ? readCachedEntitlements(userId)
              : null,
        entitlementsVerified:
          userId !== null && userId === (state.user?.id ?? null)
            ? state.entitlementsVerified
            : false,
      }
    }),

  setEntitlements: (entitlements) =>
    set((state) => {
      if (entitlements && entitlements.userId !== state.user?.id) return state
      if (entitlements) cacheEntitlements(entitlements)
      return { entitlements, entitlementsVerified: state.status === 'signed-in' }
    }),
}))

/**
 * Relit les droits, et les efface quand il n'y a plus de session.
 *
 * Appelé à chaque changement de session, et au retour d'un checkout : le
 * webhook peut arriver après la redirection de Polar, donc l'appelant relance.
 * L'échec n'écrase rien — un réseau coupé ne doit pas masquer l'état connu.
 */
export async function refreshEntitlements(): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  if (useAuthStore.getState().status !== 'signed-in' || !userId) {
    useAuthStore.setState({ entitlements: null, entitlementsVerified: false })
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
 * Le compte de la dernière session, lu dans le jeton posé par Convex Auth.
 *
 * Ce n'est pas une authentification, et le serveur n'en croit rien : chaque
 * appel repart avec le jeton, qu'il vérifie lui-même. C'est l'identité sous
 * laquelle relire le cache de droits en attendant sa réponse.
 *
 * L'expiration n'est pas regardée. La question posée n'est pas « cette session
 * est-elle valide » — le déploiement y répond — mais « ce navigateur a-t-il
 * ouvert une session, et pour qui ». Un jeton périmé accompagné de son jeton de
 * renouvellement décrit toujours le bon compte.
 */
function rememberedUserId(): string | null {
  try {
    const token = localStorage.getItem(JWT_STORAGE_KEY)
    const body = token?.split('.')[1]
    if (!body) return null
    const claims = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string }
    /* `subject` vaut `${userId}|${sessionId}` : c'est le compte qu'on veut. */
    return claims.sub?.split('|')[0] ?? null
  } catch (error) {
    console.warn('Could not read the stored session.', error)
    return null
  }
}

/**
 * Branche le store sur la session, et rend son démonteur.
 *
 * L'abonnement lui-même vit dans `lib/cloud-bridge.tsx`, parce que Convex Auth
 * n'expose son état que par des hooks : ce qui reste ici est la décision de
 * l'attendre ou non. Sans instance configurée, l'état tombe directement sur
 * `signed-out` — rien n'attend une réponse qui ne viendra pas, et rien du client
 * n'est chargé.
 *
 * La session mémorisée est posée avant de s'abonner pour afficher le dernier
 * état Cloud connu. Elle ne permet jamais une écriture sans confirmation du
 * déploiement : Convex Auth ne dit « connecté » qu'une fois sa WebSocket
 * authentifiée.
 *
 * Le rafraîchissement des droits suit le changement d'utilisateur plutôt que
 * d'être appelé par le pont : c'est la même règle qu'avant la migration, et elle
 * garde le pont ignorant de la vente. `current` part de `null` même quand une
 * session est mémorisée — la confirmation du déploiement doit valoir changement,
 * sinon des droits mis en cache avant une fin de période ne seraient jamais
 * relus.
 */
export function initAuth(): () => void {
  if (!cloudConfigured) {
    useAuthStore.setState({ status: 'signed-out', entitlementsVerified: false })
    return () => {}
  }

  const remembered = rememberedUserId()
  if (remembered) {
    useAuthStore.setState({
      status: 'signed-in',
      user: { id: remembered, email: null },
      entitlements: readCachedEntitlements(remembered),
      entitlementsVerified: false,
    })
  }

  let current: string | null = null
  return useAuthStore.subscribe((state) => {
    const next = state.user?.id ?? null
    if (next === current) return
    current = next
    void refreshEntitlements()
  })
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
  url.searchParams.delete('customer_session_token')
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
  return String(entitlements?.cloud ?? false)
}
