import { readdir } from 'node:fs/promises'
import { extname, isAbsolute, join, resolve } from 'node:path'
import type { CallToolResult } from '@modelcontextprotocol/server'
import type { ParamSchema } from '@screenforge/project-format'
import { AssetRefusedError, type AssetVault } from '../relay/assets.ts'
import type { RelayRefresh, RelayRefreshed } from '../relay/protocol.ts'
import type { RelaySession } from '../relay/session.ts'

/**
 * « J'ai refait mes captures » en un geste, sans toucher à la composition.
 *
 * Le geste existait déjà, appel par appel : `add_image` avec `role`
 * « screenshot » et un `layerId` remplit un cadre déjà posé et conserve son
 * cadrage. Ce que ça coûtait, c'était un pas d'annulation par capture et un
 * appariement laissé à la main de l'agent, qui ne voit pas la pellicule.
 *
 * Le démon fait ici la seule chose que la page ne peut pas faire — lire un
 * répertoire — et rien de plus. Il n'apparie pas : `planRefresh` sert déjà la
 * boîte « Rafraîchir » dans l'onglet, et une copie de la règle ici serait
 * d'accord avec elle jusqu'au premier correctif, puis poserait silencieusement
 * la mauvaise capture.
 *
 * `AssetVault` reste la seule porte. Lister sans récursion, filtrer sur les
 * formats connus et borner **avant** la première lecture garde cette porte de la
 * même largeur qu'avec `add_image` : un identifiant que personne n'a offert
 * n'existe pas pour la page.
 */

/** Les mêmes formats que `AssetVault`, moins le SVG : une capture n'en est pas un. */
const CAPTURE_EXTENSIONS = ['.png', '.jpg', '.jpeg']

/**
 * Dix écrans, deux appareils par planche au pire, et de la marge : au-delà, ce
 * n'est plus une livraison de captures, c'est un répertoire de travail qu'on a
 * désigné par erreur. La borne mord avant d'ouvrir le moindre fichier.
 */
const MAX_FILES = 40

export const REFRESH_SCHEMA: ParamSchema = {
  type: 'object',
  properties: {
    directory: {
      type: 'string',
      maxLength: 4096,
      description: 'Chemin absolu du répertoire contenant les captures, sans sous-dossiers.',
    },
    manifest: {
      type: 'object',
      description:
        'Facultatif : { "rôle": "nom-de-fichier.png" }, pour des exports dont les noms ne disent pas le rôle.',
    },
  },
  required: ['directory'],
  additionalProperties: false,
}

export interface RefreshArgs {
  directory: string
  manifest?: Record<string, string>
}

/**
 * Le répertoire lu, chaque capture offerte, et rien d'autre sur ce disque.
 *
 * Chaque refus nomme sa cause : un agent qui reçoit « refusé » sans savoir s'il
 * s'est trompé de chemin, s'il a désigné un fichier ou si le dossier ne
 * contient aucune image réessaie au hasard.
 */
export async function planRefreshRequest(
  vault: AssetVault,
  args: RefreshArgs,
): Promise<RelayRefresh> {
  if (!isAbsolute(args.directory)) {
    throw new AssetRefusedError(
      `Chemin relatif : « ${args.directory} ». Donnez le chemin absolu du répertoire.`,
    )
  }
  const full = await vault.authorizeDirectory(resolve(args.directory))

  const entries = await readdir(full, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) =>
      error.code === 'ENOTDIR'
        ? Promise.reject(
            new AssetRefusedError(
              `« ${full} » est un fichier, pas un répertoire. Pour une seule capture, utilisez add_image.`,
            ),
          )
        : Promise.reject(new AssetRefusedError(`Répertoire introuvable : « ${full} ».`)),
  )

  /* Sans récursion : un répertoire de captures est plat, et descendre dedans
     ferait entrer dans le coffre des fichiers que personne n'a désignés. */
  const names = entries
    .filter(
      (entry) => entry.isFile() && CAPTURE_EXTENSIONS.includes(extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (names.length === 0) {
    throw new AssetRefusedError(
      `Aucune capture dans « ${full} ». Attendu : ${CAPTURE_EXTENSIONS.join(', ')}.`,
    )
  }
  // Avant d'ouvrir quoi que ce soit : un plafond qui se découvre au trentième
  // fichier a déjà fait entrer vingt-neuf inconnus dans le coffre.
  if (names.length > MAX_FILES) {
    throw new AssetRefusedError(
      `${names.length} captures dans « ${full} », ${MAX_FILES} au plus. Désignez un répertoire de livraison.`,
    )
  }

  const files = await Promise.all(
    names.map(async (name) => {
      const asset = await vault.offer(join(full, name))
      return { name, assetId: asset.id, width: asset.width, height: asset.height }
    }),
  )

  return { files, ...(args.manifest ? { manifest: args.manifest } : {}) }
}

function isRefreshed(value: unknown): value is RelayRefreshed {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as RelayRefreshed).posed === 'number'
  )
}

/** Une section par liste, et rien pour celles qui sont vides. */
function section(title: string, lines: readonly string[]): string {
  return lines.length === 0 ? '' : `\n${title} :\n${lines.map((line) => `- ${line}`).join('\n')}`
}

function report(result: RelayRefreshed, count: number): string {
  const header =
    result.posed === 0
      ? `Aucune capture posée sur les ${count} fichier(s) lus.`
      : `${result.posed} capture(s) posée(s) en une écriture, cadrages conservés.`
  return [
    header,
    section('Appareils dont le rôle n’a trouvé aucun fichier', result.unmatched),
    section('Appareils sans rôle, jamais appariés', result.slotless),
    section('Rôles réclamés par plusieurs fichiers, aucun posé', result.ambiguous),
    section('Fichiers qu’aucun appareil ne réclame', result.unused),
  ]
    .filter(Boolean)
    .join('\n')
}

export async function refreshScreenshots(
  session: RelaySession,
  vault: AssetVault,
  args: RefreshArgs,
): Promise<CallToolResult> {
  let lease: number
  let request: RelayRefresh
  try {
    lease = session.lease()
    request = await planRefreshRequest(vault, args)
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text:
            error instanceof AssetRefusedError
              ? error.message
              : `Répertoire refusé : ${error instanceof Error ? error.message : 'cause inconnue'}.`,
        },
      ],
      isError: true,
    }
  }

  try {
    const result = await session.dispatch({ refreshScreenshots: request }, lease)
    if (!isRefreshed(result)) {
      return { content: [{ type: 'text', text: 'L’éditeur n’a rien reposé.' }], isError: true }
    }
    /* Un lot où rien n'est apparié n'est pas une erreur : c'est un rapport qui
       dit qu'aucun appareil ne porte de rôle, et l'agent a alors
       `assign_screenshot_slot` pour y remédier. */
    return { content: [{ type: 'text', text: report(result, request.files.length) }] }
  } catch (error) {
    return {
      content: [
        { type: 'text', text: error instanceof Error ? error.message : 'Pose impossible.' },
      ],
      isError: true,
    }
  }
}
