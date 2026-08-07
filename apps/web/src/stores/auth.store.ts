import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { getSupabase } from '@/lib/supabase'

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
  setSession: (session: Session | null) => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  session: null,
  user: null,

  setSession: (session) =>
    set({ session, user: session?.user ?? null, status: session ? 'signed-in' : 'signed-out' }),
}))

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
  })

  return () => subscription.unsubscribe()
}
