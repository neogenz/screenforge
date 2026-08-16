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

/**
 * Le constat, relisible sans réanalyser une phrase — et l'image reste à côté.
 *
 * `data` n'y est pas : un PNG en base64 dans un `structuredContent` serait le
 * même octet transporté deux fois, une fois en bloc image et une fois en champ.
 * Ce qui gagne à être structuré, c'est la liste : un client qui compte les
 * défauts ou les affiche n'a plus à découper un texte au tiret.
 */
export const THUMBNAIL_OUTPUT: ParamSchema = {
  type: 'object',
  properties: {
    screenId: { type: 'string' },
    width: { type: 'number' },
    height: { type: 'number' },
    findings: { type: 'array', items: { type: 'string' } },
  },
  required: ['screenId', 'width', 'height', 'findings'],
  additionalProperties: false,
}

function isRendered(value: unknown): value is RelayRendered {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RelayRendered).data === 'string' &&
    (value as RelayRendered).data.length > 0 &&
    Array.isArray((value as RelayRendered).findings)
  )
}

/**
 * Le constat avant l'image, et jamais à sa place.
 *
 * Un agent lit le premier bloc et regarde le second : l'ordre décide de ce
 * qu'il corrige. Une planche sans défaut le dit en une ligne plutôt que de ne
 * rien dire — un bloc vide se lit comme une mesure qui n'a pas eu lieu, et
 * l'agent repart alors juger à l'œil, ce que la boucle existe pour éviter.
 *
 * Rien de tout cela ne met le résultat en erreur : une composition qui déborde
 * exprès du cadre est légitime, et `get_thumbnail` reste `readOnlyHint` — il
 * énonce ce qu'il a mesuré, l'agent et l'utilisateur décident.
 */
function report(rendered: RelayRendered): string {
  const header = `Écran ${rendered.screenId} — ${rendered.width}×${rendered.height}`
  if (rendered.findings.length === 0) {
    return `${header}\nAucun défaut mesuré sur cette planche.`
  }
  const lines = rendered.findings.map((finding) => `- ${finding}`).join('\n')
  return `${header}\n${rendered.findings.length} défaut(s) mesuré(s) :\n${lines}`
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
    const { screenId, width, height, findings } = rendered
    return {
      content: [
        { type: 'text', text: report(rendered) },
        { type: 'image', data: rendered.data, mimeType: 'image/png' },
      ],
      structuredContent: { screenId, width, height, findings },
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
