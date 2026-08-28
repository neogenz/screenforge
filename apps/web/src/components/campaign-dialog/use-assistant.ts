import { useEffect, useState } from 'react'
import { connectBridge, setBridgeToken } from '@/lib/bridge-client'
import { connectApiProvider, setApiKey } from '@/lib/ai/direct-api'
import { forgetStoredSecret } from '@/lib/ai/key-store'
import { aiProvider, type ProviderId } from '@/lib/ai/providers'
import {
  assistantSession,
  rememberAssistant,
  restoreAssistant,
  type AssistantConnection,
} from '@/lib/ai/session'

/**
 * L'appairage du rédacteur, repris de la session et réécrit dedans.
 *
 * Un seul rédacteur pour toute la fiche : il écrit les accroches, traduit les
 * langues et relit l'orthographe. Deux boîtes le lisent — la fiche et les
 * langues — et ce crochet est ce qui leur évite de tenir chacune un appairage,
 * avec le même secret retapé deux fois. La session (`lib/ai/session.ts`) porte
 * l'état ; ce crochet ne fait que le monter dans React et l'y redescendre.
 */
export interface AssistantControls {
  providerId: ProviderId
  secret: string
  connection: AssistantConnection
  model: string
  connected: boolean
  connect: () => Promise<void>
  pickProvider: (next: ProviderId) => void
  setSecret: (value: string) => void
  setModel: (value: string) => void
  forgetSecret: () => void
}

export function useAssistant(): AssistantControls {
  const [restored] = useState(assistantSession)
  const [providerId, setProviderId] = useState<ProviderId>(restored.providerId)
  const [secret, setSecret] = useState(restored.secret)
  const [connection, setConnection] = useState<AssistantConnection>(restored.connection)
  const [model, setModel] = useState(restored.model)

  /* La lecture du disque est asynchrone et la boîte est chargée à la demande :
     le module et le composant arrivent ensemble, donc la valeur initiale
     ci-dessus est la meilleure hypothèse et celle-ci est la réponse. Elle ne
     s'applique qu'à une session vierge — `restoreAssistant` le vérifie — donc
     ce qui aurait été saisi entre-temps n'est pas écrasé. */
  useEffect(() => {
    let cancelled = false
    void restoreAssistant().then((settled) => {
      if (cancelled) return
      setProviderId(settled.providerId)
      setSecret(settled.secret)
      setConnection(settled.connection)
      setModel(settled.model)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* Une seule écriture, en effet, plutôt qu'un miroir dans chaque `setState` :
     quatre points d'écriture auraient dérivé au premier oubli, et écrire pendant
     le rendu ferait de la session un effet de bord du rendu. */
  useEffect(() => {
    rememberAssistant({ providerId, secret, connection, model })
  }, [providerId, secret, connection, model])

  /**
   * Appaire, quel que soit le fournisseur — et sans jamais écrire le secret.
   *
   * Les deux familles se rejoignent sur un seul état : le pont rend un `hello`
   * et une liste de modèles, une API rend son catalogue, et l'installation
   * guidée affiche la même marche dans les deux cas. Ce qui reste différent est
   * le seul fait qui compte pour l'utilisateur, et il est dans `providers.ts` :
   * un jeton n'ouvre qu'un programme de sa machine, une clé est facturée.
   */
  async function connect() {
    const trimmed = secret.trim()
    setConnection({ state: 'checking' })

    const engine = aiProvider(providerId).engine
    if (engine) {
      const status = await connectBridge(trimmed, engine)
      if (status.state !== 'ready') {
        setConnection({
          state: 'error',
          message: status.state === 'error' ? status.message : 'Le pont n’a pas répondu.',
        })
        return
      }
      /* Retenu pour la session, en mémoire de module : les deux boîtes parlent
         au même pont, et il meurt au rechargement. */
      setBridgeToken('assistant', trimmed, engine)
      setModel(status.models[0]?.id ?? '')
      setConnection({
        state: 'ready',
        models: status.models,
        detail:
          `Connecté · ${engine} ${status.hello.engines.find((one) => one.id === engine)?.version ?? ''} · jeton version ${status.hello.tokenVersions.assistant}`.trim(),
      })
      return
    }

    if (providerId === 'anthropic' || providerId === 'openrouter') {
      const status = await connectApiProvider(providerId, trimmed)
      if (status.state !== 'ready') {
        setConnection({
          state: 'error',
          message: status.state === 'error' ? status.message : 'Clé refusée.',
        })
        return
      }
      setApiKey(providerId, trimmed)
      /* Le premier modèle du catalogue n'est un défaut acceptable que sur une
         liste courte. Sur les centaines d'OpenRouter, il serait arbitraire :
         le champ reste vide, et l'étape 3 se coche quand l'utilisateur a
         choisi. */
      setModel(status.models.length > 40 ? '' : (status.models[0]?.id ?? ''))
      setConnection({
        state: 'ready',
        models: status.models,
        detail: `Clé acceptée · ${status.models.length} modèle${status.models.length > 1 ? 's' : ''} disponible${status.models.length > 1 ? 's' : ''}`,
      })
    }
  }

  /* Changer de fournisseur remet l'appairage à zéro : un jeton de pont collé
     dans le champ d'une clé Anthropic ne vaut rien, et un modèle choisi chez
     l'un n'existe pas chez l'autre. */
  function pickProvider(next: ProviderId) {
    setProviderId(next)
    setSecret('')
    setModel('')
    setConnection({ state: 'idle' })
  }

  /* Le seul chemin de sortie d'une clé enregistrée. Sans lui, la persistance
     serait à sens unique : une clé collée une fois resterait sur cette machine
     sans que rien dans l'interface ne sache la retirer. Le fournisseur et le
     modèle restent choisis — ce sont des préférences, pas des secrets. */
  function forgetSecret() {
    setSecret('')
    setConnection({ state: 'idle' })
    void forgetStoredSecret(providerId)
  }

  return {
    providerId,
    secret,
    connection,
    model,
    connected: connection.state === 'ready',
    connect,
    pickProvider,
    setSecret,
    setModel,
    forgetSecret,
  }
}
