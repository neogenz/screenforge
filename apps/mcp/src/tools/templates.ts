import type { CallToolResult } from '@modelcontextprotocol/server'
import type { ParamSchema } from '@screenforge/project-format'
import type { RelaySession } from '../relay/session.ts'

/**
 * Ce que l'agent a trouvé au troisième essai, gardé pour le projet suivant.
 *
 * Une composition réussie est le seul produit durable d'une session : le lot
 * lui-même appartient à une fiche App Store, la mise en page non. Sans un
 * endroit où la poser, l'agent recommence à chaque projet — et il recommence
 * sans mémoire, donc pas au même niveau.
 *
 * Les deux outils ne font que relayer : la bibliothèque vit dans l'IndexedDB de
 * l'onglet, pas dans ce processus. Le démon qui en garderait une copie aurait
 * deux vérités dès la première suppression faite à la souris.
 */

export const SAVE_TEMPLATE_SCHEMA: ParamSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      maxLength: 60,
      description: 'Nom du gabarit. Un nom déjà pris est refusé, pas suffixé.',
    },
    description: { type: 'string', maxLength: 200 },
    screenId: { type: 'string', maxLength: 64, description: 'Par défaut, l’écran actif.' },
  },
  required: ['name'],
  additionalProperties: false,
}

export const LIST_TEMPLATES_SCHEMA: ParamSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
}

function text(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

function refuse(detail: string): CallToolResult {
  return { content: [{ type: 'text', text: detail }], isError: true }
}

async function relay(run: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return text(await run())
  } catch (error) {
    return refuse(error instanceof Error ? error.message : 'Appel interrompu.')
  }
}

export function saveTemplate(
  session: RelaySession,
  args: { name: string; description?: string; screenId?: string },
): Promise<CallToolResult> {
  return relay(() => session.dispatch({ saveTemplate: args }))
}

export function listTemplates(session: RelaySession): Promise<CallToolResult> {
  return relay(() => session.dispatch({ listTemplates: true }))
}
