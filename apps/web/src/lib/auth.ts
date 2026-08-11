import { authActions } from '@/lib/auth-actions'
import { cloudConfigured } from '@/lib/convex'
import { toast } from '@/stores/toast.store'

export type OAuthProvider = 'google' | 'github'

/**
 * Les gestes d'authentification.
 *
 * Chacun rend une erreur au lieu d'en lever une : l'appelant est une poignée de
 * bouton, et un `throw` lui coûterait un try/catch pour dire la même chose.
 *
 * Chacun accepte aussi d'être appelé sans instance configurée. Le cas ne devrait
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
 * accueillir une session. Le serveur refait ce contrôle (`callbacks.redirect`) —
 * ici c'est une commodité, là-bas c'est la règle.
 */
function editorUrl() {
  return `${window.location.origin}/`
}

/**
 * Le message montré, jamais celui du serveur.
 *
 * Un compteur refusé arrive en `ConvexError` porteur d'un code ; le reste arrive
 * comme il peut. Les deux finissent en une phrase que quelqu'un peut lire, parce
 * qu'un nom de compteur interne n'apprend rien à qui a cliqué trop vite.
 */
export function readable(error: unknown): Error {
  const message = error instanceof Error ? error.message : ''
  /* Deux plafonds, un seul message : `RATE_LIMITED` vient de nos compteurs
     (`limits.ts`), `TooManyFailedAttempts` de ceux de Convex Auth. La
     distinction est vraie côté serveur et sans intérêt pour qui lit. */
  if (errorCode(error) === 'RATE_LIMITED' || message.includes('TooManyFailedAttempts')) {
    return new Error('Trop de tentatives. Réessayez dans un instant.')
  }
  if (/invalid|incorrect|password/i.test(message)) {
    return new Error('Adresse e-mail ou mot de passe incorrect.')
  }
  return new Error('La connexion a échoué. Réessayez.')
}

function errorCode(error: unknown): string | null {
  const data: unknown = (error as { data?: unknown })?.data
  if (typeof data === 'object' && data !== null) return (data as { code?: string }).code ?? null
  return null
}

export async function signInWithProvider(provider: OAuthProvider) {
  if (!cloudConfigured) return NOT_CONFIGURED
  try {
    const { signIn } = await authActions()
    /* Cet appel quitte la page : il n'y a pas de « succès » à observer ici, seul
       un échec revient, et il revient avant la redirection. */
    await signIn(provider, { redirectTo: editorUrl() })
    return { error: null }
  } catch (error) {
    return { error: readable(error) }
  }
}

export async function signInWithEmail(email: string) {
  if (!cloudConfigured) return NOT_CONFIGURED
  try {
    const { signIn } = await authActions()
    await signIn('resend', { email, redirectTo: editorUrl() })
    return { error: null }
  } catch (error) {
    return { error: readable(error) }
  }
}

/**
 * Le mot de passe, une porte et deux directions.
 *
 * `flow` est ce que Convex Auth attend pour distinguer une inscription d'une
 * connexion. Les deux passent par la même fonction parce que la seule différence
 * visible côté produit est le libellé du bouton, et deux fonctions donneraient
 * deux traductions d'erreur à tenir en phase.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  flow: 'signIn' | 'signUp',
) {
  if (!cloudConfigured) return NOT_CONFIGURED
  try {
    const { signIn } = await authActions()
    await signIn('password', { email, password, flow })
    return { error: null }
  } catch (error) {
    return { error: readable(error) }
  }
}

export async function signOut() {
  if (!cloudConfigured) return NOT_CONFIGURED
  try {
    const { signOut: run } = await authActions()
    await run()
    return { error: null }
  } catch (error) {
    return { error: readable(error) }
  }
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
