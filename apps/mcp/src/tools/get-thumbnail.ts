import type { CallToolResult } from '@modelcontextprotocol/server'
import type { ParamSchema } from '@screenforge/project-format'
import type { RelayRendered } from '../relay/protocol.ts'
import type { RelaySession } from '../relay/session.ts'

/**
 * L'agent voit ce qu'il vient de poser.
 *
 * C'est la seule chose que le démon ne peut pas produire seul : les polices
 * Google, les gabarits d'appareil et les captures de l'utilisateur ne vivent
 * que dans l'onglet, et un rendu côté Node en serait une approximation qui
 * mentirait exactement là où l'agent a besoin de vérité. La page rend, le démon
 * transporte.
 *
 * Le retour est un contenu image MCP et non une URL : un client qui reçoit une
 * URL doit aller la chercher, sur une boucle locale qu'il n'a aucune raison de
 * pouvoir atteindre.
 */

/**
 * 640 par défaut, 1320 au plus.
 *
 * En dessous de ~400 une accroche n'est plus lisible et l'agent corrigerait au
 * jugé, ce que la boucle existe pour éviter. Au-delà de la largeur d'export
 * réelle il n'y a plus rien à voir de plus, seulement un base64 qui double le
 * coût du tour.
 */
export const THUMBNAIL_SCHEMA: ParamSchema = {
  type: 'object',
  properties: {
    screenId: { type: 'string', maxLength: 64, description: 'Par défaut, l’écran actif.' },
    maxWidth: { type: 'number', minimum: 200, maximum: 1320 },
  },
  required: [],
  additionalProperties: false,
}

function isRendered(value: unknown): value is RelayRendered {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RelayRendered).data === 'string' &&
    (value as RelayRendered).data.length > 0
  )
}

export async function renderThumbnail(
  session: RelaySession,
  args: { screenId?: string; maxWidth?: number },
): Promise<CallToolResult> {
  try {
    const rendered = await session.dispatch({
      render: { screenId: args.screenId, maxWidth: args.maxWidth ?? 640 },
    })
    if (!isRendered(rendered)) {
      return {
        content: [{ type: 'text', text: 'L’éditeur n’a rendu aucune image.' }],
        isError: true,
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: `Écran ${rendered.screenId} — ${rendered.width}×${rendered.height}`,
        },
        { type: 'image', data: rendered.data, mimeType: 'image/png' },
      ],
    }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: error instanceof Error ? error.message : 'Rendu impossible.' },
      ],
      isError: true,
    }
  }
}
