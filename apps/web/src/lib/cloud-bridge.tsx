import { useEffect } from 'react'
import { api } from 'backend'
import { ConvexAuthProvider, useAuthActions } from '@convex-dev/auth/react'
import { useConvexAuth, useQuery } from 'convex/react'
import { publishAuthActions } from '@/lib/auth-actions'
import { client } from '@/lib/convex-client'
import { SESSION_NAMESPACE } from '@/lib/session-keys'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Le seul point de contact entre Convex et l'arbre React de l'éditeur.
 *
 * Il ne rend rien. Le fournisseur n'entoure que lui, et lui est monté en frère
 * de `App` : l'ouverture d'une session ne remonte donc jamais le canvas, et
 * l'arbre reste, sans compte, exactement celui d'avant la migration.
 *
 * Ce module n'est jamais importé statiquement — `App` le charge par `lazy()`, et
 * seulement quand l'instance est configurée. Sans elle, rien de Convex n'entre
 * dans le paquet.
 */
export default function CloudBridge() {
  return (
    <ConvexAuthProvider client={client} storageNamespace={SESSION_NAMESPACE}>
      <AuthWatcher />
    </ConvexAuthProvider>
  )
}

/**
 * L'abonnement unique qui remplace `onAuthStateChange`.
 *
 * Une seule souscription suffit et c'est important : `useQuery` rend `undefined`
 * tant que la réponse n'est pas là, ce qui est exactement l'état `unknown` du
 * store. Interroger une seconde fois en parallèle ouvrirait une fenêtre où deux
 * réponses arrivent dans le désordre.
 */
function AuthWatcher() {
  const actions = useAuthActions()
  const { isLoading } = useConvexAuth()
  const me = useQuery(api.users.me)

  useEffect(() => {
    publishAuthActions(actions)
  }, [actions])

  useEffect(() => {
    /* `undefined` n'est pas `null` : le premier dit « on ne sait pas encore », le
       second dit « personne ». Les confondre ferait clignoter « Se connecter »
       chez quelqu'un qui l'est déjà. */
    if (isLoading || me === undefined) return
    useAuthStore.getState().setUser(me)
  }, [isLoading, me])

  return null
}
