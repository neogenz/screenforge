import { apiKey, proofreadViaApi, translateViaApi, type ApiProviderId } from '@/lib/ai/direct-api'
import { aiProvider } from '@/lib/ai/providers'
import { assistantSession, type AssistantSession } from '@/lib/ai/session'
import { bridgeToken, proofreadViaBridge, translateViaBridge } from '@/lib/bridge-client'

/**
 * Un rédacteur, deux travaux : traduire, relire.
 *
 * Le rédacteur est celui de la session (`session.ts`) — le pont Claude Code,
 * une clé Anthropic ou OpenRouter — le même que celui qui écrit les accroches.
 * La boîte des langues n'a donc pas de second appairage à demander, et « qui
 * écrit » est décidé une fois pour toute la fiche.
 *
 * Les textes partent numérotés et reviennent comptés : ni identifiant de calque
 * ni image ne quittent l'onglet, et un lot rendu d'une longueur différente est
 * refusé en bloc plutôt que rattaché de travers.
 */
export interface TextLanguage {
  code: string
  name: string
}

export interface TextContext {
  appName?: string
  pitch?: string
}

export type TextJob =
  | { kind: 'translate'; source?: TextLanguage; target: TextLanguage & { script: string } }
  | { kind: 'proofread'; language: TextLanguage }

/** Le pont refuse au-delà de 120 textes par requête ; un lot plus long est découpé. */
export const TEXT_BATCH = 100
/** La borne du pont et des variantes de langue ; un calque plus long n'est pas envoyé. */
export const MAX_TEXT_JOB_LENGTH = 400

/**
 * Pourquoi rien ne peut être écrit maintenant, ou `null` quand un rédacteur répond.
 *
 * L'état est un paramètre : la session du module par défaut, ou l'état réactif
 * de `useAssistant` — qui ne réécrit la session que dans un effet, un rendu
 * après une connexion réussie, l'instant précis où le bouton doit s'activer.
 */
export function textWriterUnavailable(
  session: Pick<AssistantSession, 'providerId' | 'connection' | 'model'> = assistantSession(),
): string | null {
  const provider = aiProvider(session.providerId)
  if (provider.transport === 'in-process') {
    return 'ScreenForge seul ne traduit ni ne relit : choisissez qui écrit, puis connectez-le.'
  }
  if (session.connection.state !== 'ready') {
    return `${provider.label} n’est pas connecté : vérifiez l’appairage avant de lancer l’écriture.`
  }
  if (provider.transport === 'direct-api' && !session.model) {
    return 'Choisissez un modèle avant de lancer l’écriture.'
  }
  return null
}

export function chunked<T>(items: readonly T[], size = TEXT_BATCH): T[][] {
  const out: T[][] = []
  for (let at = 0; at < items.length; at += size) out.push(items.slice(at, at + size))
  return out
}

/** Rend autant de textes qu'il en reçoit, dans l'ordre, ou lance sans rien avoir écrit nulle part. */
export async function runTextJob(
  job: TextJob,
  texts: readonly string[],
  context?: TextContext,
): Promise<string[]> {
  const reason = textWriterUnavailable()
  if (reason) throw new Error(reason)
  if (texts.length === 0) return []
  if (texts.some((text) => text.length > MAX_TEXT_JOB_LENGTH)) {
    throw new Error(`Un texte dépasse ${MAX_TEXT_JOB_LENGTH} caractères : rien n’a été envoyé.`)
  }
  const session = assistantSession()
  const provider = aiProvider(session.providerId)
  const batches = await Promise.all(
    chunked(texts).map((batch) => {
      if (provider.transport === 'local-bridge') {
        const token = bridgeToken('assistant') || session.secret
        const engine = provider.engine ?? 'claude'
        return job.kind === 'translate'
          ? translateViaBridge(job.target, batch, token, engine, { source: job.source, context })
          : proofreadViaBridge(job.language, batch, token, engine, context)
      }
      const id = session.providerId as ApiProviderId
      const key = apiKey(id) || session.secret
      return job.kind === 'translate'
        ? translateViaApi(id, key, session.model, job.target, batch, {
            source: job.source,
            context,
          })
        : proofreadViaApi(id, key, session.model, job.language, batch, context)
    }),
  )
  const out = batches.flat()
  if (out.length !== texts.length) {
    throw new Error('Le rédacteur a rendu un nombre de textes inattendu : rien n’a été repris.')
  }
  return out
}
