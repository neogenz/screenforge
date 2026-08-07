import { getSupabase } from '@/lib/supabase'
import { toast } from '@/stores/toast.store'

export type OAuthProvider = 'google' | 'github'

/**
 * Les trois gestes d'authentification.
 *
 * Chacun rend une erreur au lieu d'en lever une : l'appelant est une poignée de
 * bouton, et un `throw` lui coûterait un try/catch pour dire la même chose.
 *
 * Chacun accepte aussi d'être appelé sans client configuré. Le cas ne devrait
 * pas se produire — l'interface de compte ne se monte pas sans les variables —
 * mais la garde vaut mieux qu'une assertion qui deviendrait fausse le jour où
 * un raccourci, la palette ou un lien profond ouvre la dialog par un autre
 * chemin.
 */
const NOT_CONFIGURED = {
  error: new Error('Le compte n’est pas disponible sur cette instance.'),
}

/**
 * Le retour d'authentification atterrit sur l'éditeur, jamais sur la vitrine :
 * c'est de l'éditeur qu'on part, et `landing.html` n'a ni store ni canvas pour
 * accueillir une session.
 */
function editorUrl() {
  return `${window.location.origin}/`
}

export async function signInWithProvider(provider: OAuthProvider) {
  const pending = getSupabase()
  if (!pending) return NOT_CONFIGURED
  const supabase = await pending
  /* Cet appel quitte la page : il n'y a pas de « succès » à observer ici, seul
     un échec revient, et il revient avant la redirection. */
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: editorUrl() },
  })
  return { error }
}

export async function signInWithEmail(email: string) {
  const pending = getSupabase()
  if (!pending) return NOT_CONFIGURED
  const supabase = await pending
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: editorUrl() },
  })
  return { error }
}

export async function signOut() {
  const pending = getSupabase()
  if (!pending) return NOT_CONFIGURED
  const supabase = await pending
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Se déconnecter, et le dire.
 *
 * Deux entrées mènent ici — la barre du haut et la palette — pour un geste dont
 * la seule confirmation visible est la disparition d'un libellé dans un menu
 * fermé. Le message vit donc ici plutôt que chez chaque appelant : deux
 * formulations pour le même échec, ça se constate longtemps après.
 */
export async function signOutAndReport() {
  const { error } = await signOut()
  if (error) toast(error.message, 'error')
  else toast('Déconnecté.', 'success')
}
