import { AppUnavailableError, CallFailedError, type RelaySession } from '../relay/session.ts'

/**
 * Les deux lectures du contrat — répondues ici, sans réveiller l'éditeur.
 *
 * `get_project_state` et `get_screen` sont déclarés `readOnly` dans
 * `AI_TOOLS`, et `validateToolCall` les refuse par construction : ils ne
 * passent pas par l'exécuteur, qui n'écrit que des mutations. Le démon les sert
 * donc depuis le dernier état poussé par la page — qui pousse à l'ouverture du
 * flux puis après chaque écriture.
 *
 * Poussé plutôt que demandé : un agent relit l'état à presque chaque tour, et
 * un aller-retour SSE par lecture paierait une latence pour une réponse que la
 * page connaît déjà. Le prix est que l'état date de la dernière écriture ; ce
 * qui se passe entre deux écritures, c'est l'utilisateur qui le fait, et il est
 * devant son écran.
 *
 * L'état reste opaque au relais. Il transporte du JSON produit par
 * `describeProject`, et n'en lit que ce qu'il faut pour isoler un écran.
 */

interface StateWithScreens {
  screens: { id?: unknown }[]
}

function hasScreens(state: unknown): state is StateWithScreens {
  return (
    typeof state === 'object' &&
    state !== null &&
    Array.isArray((state as { screens?: unknown }).screens)
  )
}

function requireState(session: RelaySession): unknown {
  const state = session.state
  if (state === null) {
    if (!session.connected) throw new AppUnavailableError()
    throw new AppUnavailableError(
      'L’éditeur est connecté mais n’a pas encore poussé son projet. Réessayez dans un instant.',
    )
  }
  return state
}

/** Réponse de `get_project_state` : le projet, ses écrans, ses calques. */
export function readProjectState(session: RelaySession): unknown {
  return requireState(session)
}

/** Réponse de `get_screen` : un écran du dernier état poussé. */
export function readScreen(session: RelaySession, screenId: string): unknown {
  const state = requireState(session)
  const screen = hasScreens(state)
    ? state.screens.find((candidate) => candidate.id === screenId)
    : undefined
  if (!screen) throw new CallFailedError(`Aucun écran « ${screenId} » dans le projet ouvert.`)
  return screen
}
