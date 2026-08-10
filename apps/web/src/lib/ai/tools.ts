import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/lib/canvas/canvas-utils'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { createDefaultScreen } from '@/stores/project.store'
import { defaultScreenName } from '@/lib/screens'
import {
  createDeviceLayer,
  createIconLayer,
  createShapeLayer,
  createTextLayer,
} from '@/lib/layer-factories'
import { normalizeScreenshotPlacement } from '@/lib/screenshot-placement'
import { normalizeSlot } from '@/lib/slots'
import { DEVICE_FRAMES } from '@/assets/device-frames'
import { ICON_CATALOG, SHAPE_CATALOG } from '@/lib/vector-catalog'
import { POPULAR_FONTS } from '@/lib/fonts'
import type { Background, DeviceModel, Layer, LayerType, Project, Screen } from '@/types'

/**
 * Ce qu'un modèle peut faire au projet, et rien d'autre.
 *
 * Le principe de la phase : **le modèle décide, le dépôt écrit**. Aucun outil
 * n'accepte de JSON Fabric, d'image aplatie ni d'accès générique aux stores —
 * chacun appelle les mêmes fabriques que les boutons de la barre d'outils, et
 * produit donc des calques ScreenForge ordinaires, éditables et exportables.
 * Un modèle qui déraille peut au pire poser un texte au mauvais endroit.
 *
 * Les schémas sont stricts (`additionalProperties: false`, énumérations
 * fermées, bornes numériques) pour deux raisons qui n'ont rien à voir : ils
 * partent tels quels dans la requête d'un fournisseur qui sait appeler des
 * outils, et ils sont revalidés ici à l'arrivée, parce qu'un schéma envoyé
 * n'est pas un schéma respecté.
 */

export const AI_LIMITS = {
  /** Le plafond du projet, pas un second plafond qui divergerait du premier. */
  maxScreens: MAX_PROJECT_SCREENS,
  maxLayersPerScreen: 24,
  maxCalls: 200,
  /** Un calque peut déborder de la planche, pas s'en échapper. */
  minCoordinate: -SCREEN_WIDTH,
  maxCoordinate: 2 * SCREEN_WIDTH,
  minSize: 4,
  maxSize: 2 * SCREEN_HEIGHT,
  maxTextLength: 400,
  maxNameLength: 60,
} as const

const HEX_COLOR = '^#[0-9a-fA-F]{6}$'

/** Sous-ensemble de JSON Schema effectivement utilisé et validé ici. */
export interface ParamSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  description?: string
  enum?: readonly string[]
  pattern?: string
  minimum?: number
  maximum?: number
  maxLength?: number
  maxItems?: number
  items?: ParamSchema
  properties?: Record<string, ParamSchema>
  required?: readonly string[]
  additionalProperties?: false
}

export interface ToolSchema {
  name: ToolName
  description: string
  /** Une lecture ne passe pas par l'exécuteur : elle ne modifie rien. */
  readOnly?: boolean
  parameters: ParamSchema
}

export type ToolName =
  | 'get_project_state'
  | 'get_screen'
  | 'declare_plan'
  | 'add_screen'
  | 'set_background'
  | 'add_text'
  | 'add_shape'
  | 'add_icon'
  | 'add_device'
  | 'add_image'
  | 'update_layer'
  | 'delete_layer'
  | 'assign_screenshot_slot'
  | 'place_screenshot_asset'

export interface ToolCall {
  tool: ToolName
  args: Record<string, unknown>
}

const coordinate: ParamSchema = {
  type: 'number',
  minimum: AI_LIMITS.minCoordinate,
  maximum: AI_LIMITS.maxCoordinate,
}
const size: ParamSchema = { type: 'number', minimum: AI_LIMITS.minSize, maximum: AI_LIMITS.maxSize }
const color: ParamSchema = { type: 'string', pattern: HEX_COLOR }
const layerId: ParamSchema = { type: 'string', maxLength: 64 }
const screenId: ParamSchema = {
  type: 'string',
  maxLength: 64,
  description: 'Écran visé. Par défaut, le dernier écran créé par ce run.',
}

const colorStop: ParamSchema = {
  type: 'object',
  properties: { offset: { type: 'number', minimum: 0, maximum: 1 }, color },
  required: ['offset', 'color'],
  additionalProperties: false,
}

const background: ParamSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['solid', 'linear-gradient', 'radial-gradient'] },
    color,
    angle: { type: 'number', minimum: 0, maximum: 360 },
    stops: { type: 'array', maxItems: 6, items: colorStop },
  },
  required: ['type'],
  additionalProperties: false,
}

const geometry: Record<string, ParamSchema> = {
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
}

function object(
  properties: Record<string, ParamSchema>,
  required: readonly string[] = [],
): ParamSchema {
  return { type: 'object', properties, required, additionalProperties: false }
}

const deviceModels = DEVICE_FRAMES.map((frame) => frame.model)
const shapeIds = SHAPE_CATALOG.map((entry) => entry.id)
const iconIds = ICON_CATALOG.map((entry) => entry.id)

export const AI_TOOLS: readonly ToolSchema[] = [
  {
    name: 'get_project_state',
    description: 'Lit le projet : écrans, calques, réglages. Aucune image n’est renvoyée.',
    readOnly: true,
    parameters: object({}),
  },
  {
    name: 'get_screen',
    description: 'Lit un écran et ses calques.',
    readOnly: true,
    parameters: object({ screenId }, ['screenId']),
  },
  {
    name: 'declare_plan',
    description:
      'Annonce le plan de campagne avant de l’exécuter. Ne modifie rien : sert la revue humaine.',
    parameters: object(
      {
        summary: { type: 'string', maxLength: 400 },
        screens: {
          type: 'array',
          maxItems: AI_LIMITS.maxScreens,
          items: object(
            {
              name: { type: 'string', maxLength: AI_LIMITS.maxNameLength },
              headline: { type: 'string', maxLength: AI_LIMITS.maxTextLength },
              slot: { type: 'string', maxLength: 48 },
            },
            ['name', 'headline'],
          ),
        },
      },
      ['screens'],
    ),
  },
  {
    name: 'add_screen',
    description: 'Ajoute une planche à la fin de la campagne et la vise pour la suite.',
    parameters: object({ name: { type: 'string', maxLength: AI_LIMITS.maxNameLength } }),
  },
  {
    name: 'set_background',
    description: 'Remplace le fond d’un écran.',
    parameters: object({ screenId, background }, ['background']),
  },
  {
    name: 'add_text',
    description: 'Pose un calque de texte.',
    parameters: object(
      {
        screenId,
        content: { type: 'string', maxLength: AI_LIMITS.maxTextLength },
        ...geometry,
        fontFamily: { type: 'string', enum: POPULAR_FONTS },
        fontSize: { type: 'number', minimum: 8, maximum: 240 },
        fontWeight: { type: 'integer', minimum: 100, maximum: 900 },
        color,
        textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
      },
      ['content'],
    ),
  },
  {
    name: 'add_shape',
    description: 'Pose une forme du catalogue.',
    parameters: object(
      { screenId, shapeType: { type: 'string', enum: shapeIds }, ...geometry, fill: color },
      ['shapeType'],
    ),
  },
  {
    name: 'add_icon',
    description: 'Pose une icône du catalogue.',
    parameters: object(
      {
        screenId,
        iconId: { type: 'string', enum: iconIds },
        ...geometry,
        color,
        strokeWidth: { type: 'number', minimum: 0.5, maximum: 6 },
      },
      ['iconId'],
    ),
  },
  {
    name: 'add_device',
    description: 'Pose un cadre iPhone, avec son rôle et sa capture si elle est fournie.',
    parameters: object({
      screenId,
      deviceModel: { type: 'string', enum: deviceModels },
      ...geometry,
      slot: { type: 'string', maxLength: 48 },
      assetId: { type: 'string', maxLength: 64 },
      screenshotWidth: { type: 'number', minimum: 1, maximum: 20000 },
      screenshotHeight: { type: 'number', minimum: 1, maximum: 20000 },
    }),
  },
  {
    name: 'add_image',
    description:
      'Pose une image que l’utilisateur a lui-même fournie (son logo). Aucune image n’est inventée.',
    parameters: object(
      {
        screenId,
        assetId: { type: 'string', maxLength: 64 },
        originalWidth: { type: 'number', minimum: 1, maximum: 20000 },
        originalHeight: { type: 'number', minimum: 1, maximum: 20000 },
        name: { type: 'string', maxLength: AI_LIMITS.maxNameLength },
        ...geometry,
      },
      ['assetId', 'originalWidth', 'originalHeight'],
    ),
  },
  {
    name: 'update_layer',
    description:
      'Modifie un calque existant. Seules les propriétés listées pour son type sont acceptées.',
    parameters: object(
      {
        layerId,
        patch: object({
          name: { type: 'string', maxLength: AI_LIMITS.maxNameLength },
          ...geometry,
          rotation: { type: 'number', minimum: -360, maximum: 360 },
          opacity: { type: 'number', minimum: 0, maximum: 1 },
          visible: { type: 'boolean' },
          content: { type: 'string', maxLength: AI_LIMITS.maxTextLength },
          fontFamily: { type: 'string', enum: POPULAR_FONTS },
          fontSize: { type: 'number', minimum: 8, maximum: 240 },
          fontWeight: { type: 'integer', minimum: 100, maximum: 900 },
          textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
          color,
          fill: color,
          shapeType: { type: 'string', enum: shapeIds },
          iconId: { type: 'string', enum: iconIds },
          deviceModel: { type: 'string', enum: deviceModels },
        }),
      },
      ['layerId', 'patch'],
    ),
  },
  {
    name: 'delete_layer',
    description: 'Retire un calque.',
    parameters: object({ layerId }, ['layerId']),
  },
  {
    name: 'assign_screenshot_slot',
    description:
      'Donne son rôle de campagne à un appareil : c’est ce qui rend la release rejouable.',
    parameters: object({ layerId, slot: { type: 'string', maxLength: 48 } }, ['layerId', 'slot']),
  },
  {
    name: 'place_screenshot_asset',
    description:
      'Pose une capture importée par l’utilisateur dans un appareil. Le cadrage existant est conservé.',
    parameters: object(
      {
        layerId,
        assetId: { type: 'string', maxLength: 64 },
        width: { type: 'number', minimum: 1, maximum: 20000 },
        height: { type: 'number', minimum: 1, maximum: 20000 },
      },
      ['layerId', 'assetId', 'width', 'height'],
    ),
  },
]

export function toolSchema(name: string): ToolSchema | undefined {
  return AI_TOOLS.find((tool) => tool.name === name)
}

/**
 * Valide une valeur contre le sous-ensemble de schéma utilisé ici.
 *
 * Écrit à la main plutôt qu'emprunté : le validateur doit refuser ce que le
 * schéma ne dit pas (`additionalProperties: false` partout), et le schéma doit
 * partir tel quel dans une requête d'outil. Une bibliothèque de validation
 * aurait demandé une seconde bibliothèque pour la convertir en JSON Schema.
 */
export function validateAgainst(schema: ParamSchema, value: unknown, path = 'args'): string | null {
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return `${path} : objet attendu`
    }
    const entries = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (entries[key] === undefined) return `${path}.${key} : requis`
    }
    for (const [key, entry] of Object.entries(entries)) {
      const property = schema.properties?.[key]
      if (!property) return `${path}.${key} : propriété inconnue`
      if (entry === undefined) continue
      const error = validateAgainst(property, entry, `${path}.${key}`)
      if (error) return error
    }
    return null
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return `${path} : tableau attendu`
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      return `${path} : ${schema.maxItems} éléments au plus`
    }
    for (const [index, entry] of value.entries()) {
      const error = validateAgainst(schema.items!, entry, `${path}[${index}]`)
      if (error) return error
    }
    return null
  }
  if (schema.type === 'boolean') {
    return typeof value === 'boolean' ? null : `${path} : booléen attendu`
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return `${path} : texte attendu`
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      return `${path} : ${schema.maxLength} caractères au plus`
    }
    if (schema.enum && !schema.enum.includes(value)) return `${path} : valeur hors catalogue`
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      return `${path} : format invalide`
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${path} : nombre attendu`
  if (schema.type === 'integer' && !Number.isInteger(value)) return `${path} : entier attendu`
  if (schema.minimum !== undefined && value < schema.minimum)
    return `${path} : minimum ${schema.minimum}`
  if (schema.maximum !== undefined && value > schema.maximum)
    return `${path} : maximum ${schema.maximum}`
  return null
}

/** Refuse un appel avant qu'il n'atteigne le projet. */
export function validateToolCall(call: ToolCall): string | null {
  const schema = toolSchema(call.tool)
  if (!schema) return `Outil inconnu : ${String(call.tool)}`
  if (schema.readOnly) return `${call.tool} est en lecture seule`
  return validateAgainst(schema.parameters, call.args ?? {})
}

/**
 * Ce qu'un patch peut toucher, par type de calque.
 *
 * L'allowlist est par type et non globale : `content` sur une forme ou
 * `iconId` sur un texte produirait un calque que la validation du projet
 * accepte et que le moteur de rendu ignore — un calque mort, invisible à
 * l'export, sans erreur nulle part. Les identifiants (`id`, `assetId`,
 * `screenshotAssetId`), le `zIndex` et le verrou n'y sont jamais : ils sont
 * l'affaire des outils dédiés ou de personne.
 */
const COMMON_PATCH = [
  'name',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'opacity',
  'visible',
] as const

export const PATCHABLE_PROPS: Record<LayerType, readonly string[]> = {
  text: [...COMMON_PATCH, 'content', 'fontFamily', 'fontSize', 'fontWeight', 'color', 'textAlign'],
  shape: [...COMMON_PATCH, 'shapeType', 'fill'],
  icon: [...COMMON_PATCH, 'iconId', 'color'],
  image: COMMON_PATCH,
  'device-frame': [...COMMON_PATCH, 'deviceModel'],
}

export interface ToolContext {
  /** Édition ciblée : tout ce qui sort de cet écran est refusé. */
  screenId?: string
  /** Assets que l'utilisateur a lui-même importés pour ce run. */
  assetIds?: readonly string[]
}

export interface ToolResult {
  tool: ToolName
  screenId?: string
  layerId?: string
}

export interface ExecutionOutcome {
  results: ToolResult[]
  /** Renseigné dès le premier appel refusé : le lot entier est alors perdu. */
  error?: string
}

function findLayer(draft: Project, id: string): { layer: Layer; screen?: Screen } | undefined {
  for (const screen of draft.screens) {
    const layer = screen.layers.find((candidate) => candidate.id === id)
    if (layer) return { layer, screen }
  }
  const shared = draft.layoutLayers.find((candidate) => candidate.id === id)
  return shared ? { layer: shared } : undefined
}

function place(layer: Layer, args: Record<string, unknown>): Layer {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    if (typeof args[key] === 'number') layer[key] = args[key]
  }
  return layer
}

/**
 * Applique un lot d'appels sur un brouillon. Le premier refus arrête tout.
 *
 * Le brouillon appartient à l'appelant : c'est `runEditorTransaction` qui le
 * clone, le valide et le publie en une écriture, donc un run refusé ici n'a
 * jamais existé pour le reste de l'application.
 */
export function applyToolCalls(
  draft: Project,
  calls: readonly ToolCall[],
  context: ToolContext = {},
): ExecutionOutcome {
  const results: ToolResult[] = []
  if (calls.length > AI_LIMITS.maxCalls) {
    return { results, error: `Trop d’opérations : ${AI_LIMITS.maxCalls} au plus` }
  }

  let cursor = context.screenId ?? draft.activeScreenId

  const targetScreen = (args: Record<string, unknown>): Screen | string => {
    const asked = typeof args.screenId === 'string' ? args.screenId : undefined
    if (context.screenId && asked && asked !== context.screenId) {
      return 'Édition limitée à l’écran sélectionné'
    }
    const id = context.screenId ?? asked ?? cursor
    return draft.screens.find((screen) => screen.id === id) ?? `Écran introuvable : ${id}`
  }

  const push = (screen: Screen, layer: Layer, tool: ToolName): string | null => {
    if (screen.layers.length >= AI_LIMITS.maxLayersPerScreen) {
      return `Écran « ${screen.name} » : ${AI_LIMITS.maxLayersPerScreen} calques au plus`
    }
    layer.zIndex = screen.layers.length
    screen.layers.push(layer)
    results.push({ tool, screenId: screen.id, layerId: layer.id })
    return null
  }

  for (const call of calls) {
    const invalid = validateToolCall(call)
    if (invalid) return { results, error: invalid }
    const args = call.args ?? {}

    switch (call.tool) {
      case 'declare_plan':
        results.push({ tool: call.tool })
        break

      case 'add_screen': {
        if (context.screenId) return { results, error: 'Édition limitée à l’écran sélectionné' }
        if (draft.screens.length >= AI_LIMITS.maxScreens) {
          return { results, error: `Campagne pleine : ${AI_LIMITS.maxScreens} écrans au plus` }
        }
        const name =
          typeof args.name === 'string' && args.name.trim()
            ? args.name.trim()
            : defaultScreenName(draft.screens.length)
        const screen = createDefaultScreen(name, draft.globals)
        draft.screens.push(screen)
        cursor = screen.id
        results.push({ tool: call.tool, screenId: screen.id })
        break
      }

      case 'set_background': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        screen.background = args.background as Background
        results.push({ tool: call.tool, screenId: screen.id })
        break
      }

      case 'add_text': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        const layer = createTextLayer(0)
        layer.content = args.content as string
        if (typeof args.fontFamily === 'string') layer.fontFamily = args.fontFamily
        if (typeof args.fontSize === 'number') layer.fontSize = args.fontSize
        if (typeof args.fontWeight === 'number') layer.fontWeight = args.fontWeight
        if (typeof args.color === 'string') layer.color = args.color
        if (typeof args.textAlign === 'string') {
          layer.textAlign = args.textAlign as typeof layer.textAlign
        }
        const failure = push(screen, place(layer, args), call.tool)
        if (failure) return { results, error: failure }
        break
      }

      case 'add_shape': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        const layer = createShapeLayer(0, args.shapeType as never)
        if (typeof args.fill === 'string') layer.fill = args.fill
        const failure = push(screen, place(layer, args), call.tool)
        if (failure) return { results, error: failure }
        break
      }

      case 'add_icon': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        const layer = createIconLayer(0, args.iconId as never)
        if (typeof args.color === 'string') layer.color = args.color
        if (typeof args.strokeWidth === 'number') layer.strokeWidth = args.strokeWidth
        const failure = push(screen, place(layer, args), call.tool)
        if (failure) return { results, error: failure }
        break
      }

      case 'add_device': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        const model = (args.deviceModel as DeviceModel | undefined) ?? draft.globals.deviceModel
        const layer = createDeviceLayer(model, 0)
        if (typeof args.slot === 'string') {
          const slot = normalizeSlot(args.slot)
          if (!slot) return { results, error: `Rôle inutilisable : ${args.slot}` }
          layer.slot = slot
        }
        if (typeof args.assetId === 'string') {
          if (!context.assetIds?.includes(args.assetId)) {
            return { results, error: 'Capture inconnue de ce run' }
          }
          if (
            typeof args.screenshotWidth !== 'number' ||
            typeof args.screenshotHeight !== 'number'
          ) {
            return { results, error: 'Une capture sans dimensions ne peut pas être cadrée' }
          }
          layer.screenshotAssetId = args.assetId
          layer.screenshotSize = { width: args.screenshotWidth, height: args.screenshotHeight }
          layer.placement = normalizeScreenshotPlacement(undefined)
        }
        const failure = push(screen, place(layer, args), call.tool)
        if (failure) return { results, error: failure }
        break
      }

      case 'add_image': {
        const screen = targetScreen(args)
        if (typeof screen === 'string') return { results, error: screen }
        if (!context.assetIds?.includes(args.assetId as string)) {
          return { results, error: 'Image inconnue de ce run' }
        }
        const layer: Layer = {
          id: crypto.randomUUID(),
          type: 'image',
          name: typeof args.name === 'string' && args.name.trim() ? args.name.trim() : 'Logo',
          x: 0,
          y: 0,
          width: args.originalWidth as number,
          height: args.originalHeight as number,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: 0,
          assetId: args.assetId as string,
          originalWidth: args.originalWidth as number,
          originalHeight: args.originalHeight as number,
        }
        const failure = push(screen, place(layer, args), call.tool)
        if (failure) return { results, error: failure }
        break
      }

      case 'update_layer': {
        const found = findLayer(draft, args.layerId as string)
        if (!found) return { results, error: `Calque introuvable : ${String(args.layerId)}` }
        if (context.screenId && found.screen?.id !== context.screenId) {
          return { results, error: 'Édition limitée à l’écran sélectionné' }
        }
        if (found.layer.locked) return { results, error: `Calque verrouillé : ${found.layer.name}` }
        const allowed = PATCHABLE_PROPS[found.layer.type]
        const patch = (args.patch ?? {}) as Record<string, unknown>
        for (const [key, value] of Object.entries(patch)) {
          if (!allowed.includes(key)) {
            return {
              results,
              error: `${key} n’est pas modifiable sur un calque ${found.layer.type}`,
            }
          }
          ;(found.layer as unknown as Record<string, unknown>)[key] = value
        }
        results.push({ tool: call.tool, screenId: found.screen?.id, layerId: found.layer.id })
        break
      }

      case 'delete_layer': {
        const found = findLayer(draft, args.layerId as string)
        if (!found) return { results, error: `Calque introuvable : ${String(args.layerId)}` }
        if (context.screenId && found.screen?.id !== context.screenId) {
          return { results, error: 'Édition limitée à l’écran sélectionné' }
        }
        const list = found.screen ? found.screen.layers : draft.layoutLayers
        list.splice(list.indexOf(found.layer), 1)
        list.forEach((layer, index) => {
          layer.zIndex = index
        })
        results.push({ tool: call.tool, screenId: found.screen?.id, layerId: found.layer.id })
        break
      }

      case 'assign_screenshot_slot': {
        const found = findLayer(draft, args.layerId as string)
        if (found?.layer.type !== 'device-frame') {
          return { results, error: 'Un rôle ne se pose que sur un appareil' }
        }
        if (context.screenId && found.screen?.id !== context.screenId) {
          return { results, error: 'Édition limitée à l’écran sélectionné' }
        }
        const slot = normalizeSlot(args.slot as string)
        if (!slot) return { results, error: `Rôle inutilisable : ${String(args.slot)}` }
        found.layer.slot = slot
        results.push({ tool: call.tool, screenId: found.screen?.id, layerId: found.layer.id })
        break
      }

      case 'place_screenshot_asset': {
        const found = findLayer(draft, args.layerId as string)
        if (found?.layer.type !== 'device-frame') {
          return { results, error: 'Une capture ne se pose que dans un appareil' }
        }
        if (context.screenId && found.screen?.id !== context.screenId) {
          return { results, error: 'Édition limitée à l’écran sélectionné' }
        }
        if (!context.assetIds?.includes(args.assetId as string)) {
          return { results, error: 'Capture inconnue de ce run' }
        }
        found.layer.screenshotAssetId = args.assetId as string
        found.layer.screenshotSize = { width: args.width as number, height: args.height as number }
        // Le cadrage n'est pas retouché : c'est la promesse de la phase 2.
        results.push({ tool: call.tool, screenId: found.screen?.id, layerId: found.layer.id })
        break
      }

      default:
        return { results, error: `Outil non exécutable : ${String(call.tool)}` }
    }
  }

  return { results }
}
