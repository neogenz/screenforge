import { DEVICE_MODEL_IDS, type ParamSchema, type ToolCall } from '@screenforge/project-format'
import { AssetRefusedError, type AssetVault } from '../relay/assets.ts'

/**
 * Un fichier du disque de l'utilisateur devient un calque du projet ouvert.
 *
 * Le chemin ne voyage pas jusqu'à la page : il entre dans le coffre, qui rend
 * un identifiant, et c'est cet identifiant que l'appel porte. L'onglet le
 * récupère par `GET /asset/:id`, l'enregistre chez lui, et n'a jamais eu à
 * connaître un emplacement sur ce disque.
 *
 * L'outil produit un appel du contrat — `add_image` ou `add_device` — plutôt
 * qu'un chemin d'écriture à lui : c'est ce qui garantit que ce que l'agent pose
 * par le MCP est exactement ce que la barre d'outils pose, et donc que le
 * résultat est un calque ordinaire, éditable et exportable.
 *
 * Les dimensions sont lues dans l'en-tête du fichier, ici et pas dans la page :
 * le démon doit produire un appel qui passe `validateToolCall` avant de
 * l'envoyer, et `add_image` comme `add_device` les exigent — un cadrage
 * « cover » sans le rapport de la source est incalculable.
 */

/** Le même ajustement que l'import à la souris, pour que les deux se ressemblent. */
const FIT = 600

const geometry: Record<string, ParamSchema> = {
  x: { type: 'number', minimum: -5000, maximum: 5000 },
  y: { type: 'number', minimum: -5000, maximum: 5000 },
  width: { type: 'number', minimum: 1, maximum: 5000 },
  height: { type: 'number', minimum: 1, maximum: 5000 },
  rotation: { type: 'number', minimum: -360, maximum: 360 },
  opacity: { type: 'number', minimum: 0, maximum: 1 },
}

export const ADD_IMAGE_SCHEMA: ParamSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      maxLength: 4096,
      description: 'Chemin absolu d’un PNG, JPEG ou SVG sur cette machine.',
    },
    role: {
      type: 'string',
      enum: ['image', 'screenshot'],
      description:
        '« image » pose un calque image (un logo). « screenshot » pose un cadre iPhone portant la capture.',
    },
    screenId: { type: 'string', maxLength: 64, description: 'Par défaut, l’écran actif.' },
    layerId: {
      type: 'string',
      maxLength: 64,
      description:
        'Pour « screenshot » : remplit un cadre iPhone déjà posé au lieu d’en ajouter un. Le cadrage existant est conservé.',
    },
    name: { type: 'string', maxLength: 80 },
    slot: { type: 'string', maxLength: 48, description: 'Rôle de l’écran, pour « screenshot ».' },
    deviceModel: { type: 'string', enum: DEVICE_MODEL_IDS },
    ...geometry,
  },
  required: ['path', 'role'],
  additionalProperties: false,
}

export interface AddImageArgs {
  path: string
  role: 'image' | 'screenshot'
  screenId?: string
  layerId?: string
  name?: string
  slot?: string
  deviceModel?: string
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
  opacity?: number
}

const PLACEMENT = ['screenId', 'x', 'y', 'width', 'height', 'rotation', 'opacity'] as const

function placement(args: AddImageArgs): Record<string, unknown> {
  const kept: Record<string, unknown> = {}
  for (const key of PLACEMENT) {
    if (args[key] !== undefined) kept[key] = args[key]
  }
  return kept
}

/**
 * Construit l'appel du contrat, ou lève un refus que l'agent peut suivre.
 *
 * `AssetRefusedError` remonte tel quel : chemin relatif, format inconnu,
 * fichier absent ou trop lourd sont quatre corrections différentes, et un
 * « refusé » nu les rendrait indiscernables.
 */
export async function planAddImage(vault: AssetVault, args: AddImageArgs): Promise<ToolCall> {
  const asset = await vault.offer(args.path)

  if (args.role === 'screenshot') {
    if (asset.mediaType === 'image/svg+xml') {
      throw new AssetRefusedError(
        'Une capture d’écran est un PNG ou un JPEG ; un SVG se pose avec role « image ».',
      )
    }
    /* Remplir un cadre déjà posé n'est pas en ajouter un : c'est le geste
       « j'ai refait mes captures », et il doit garder le cadrage que
       l'utilisateur a réglé sur cet appareil. */
    if (args.layerId) {
      return {
        tool: 'place_screenshot_asset',
        args: {
          layerId: args.layerId,
          assetId: asset.id,
          width: asset.width,
          height: asset.height,
        },
      }
    }
    return {
      tool: 'add_device',
      args: {
        ...placement(args),
        ...(args.deviceModel ? { deviceModel: args.deviceModel } : {}),
        ...(args.slot ? { slot: args.slot } : {}),
        assetId: asset.id,
        screenshotWidth: asset.width,
        screenshotHeight: asset.height,
      },
    }
  }

  /* Sans consigne, l'image prend la taille qu'elle aurait à la souris. Le
     contrat pose le calque à ses pixels d'origine, ce qui fait d'un logo de
     1200px un calque trois fois plus large que la planche. */
  const scale = Math.min(FIT / asset.width, FIT / asset.height, 1)
  return {
    tool: 'add_image',
    args: {
      width: Math.max(1, Math.round(asset.width * scale)),
      height: Math.max(1, Math.round(asset.height * scale)),
      ...placement(args),
      ...(args.name ? { name: args.name } : {}),
      assetId: asset.id,
      originalWidth: asset.width,
      originalHeight: asset.height,
    },
  }
}
