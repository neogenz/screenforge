import { MAX_PROJECT_SCREENS } from './dimensions.ts'
import type { LayerType } from './types.ts'

/**
 * Ce qu'un modèle peut faire au projet, et rien d'autre — la partie
 * déclarative du contrat.
 *
 * Le principe : **le modèle décide, le dépôt écrit**. Aucun outil n'accepte de
 * JSON Fabric, d'image aplatie ni d'accès générique aux stores — chacun
 * appelle, côté éditeur, les mêmes fabriques que les boutons de la barre
 * d'outils, et produit donc des calques ScreenForge ordinaires, éditables et
 * exportables. Un modèle qui déraille peut au pire poser un texte au mauvais
 * endroit.
 *
 * Les schémas sont stricts (`additionalProperties: false`, énumérations
 * fermées, bornes numériques) pour deux raisons qui n'ont rien à voir : ils
 * partent tels quels dans la requête d'un fournisseur qui sait appeler des
 * outils, et ils sont revalidés à l'arrivée, parce qu'un schéma envoyé n'est
 * pas un schéma respecté.
 *
 * L'exécution (`applyToolCalls`) n'est pas ici : elle touche les fabriques de
 * calques de l'éditeur et vit dans `apps/web/src/lib/ai/tools.ts`.
 */

/*
   Les bornes de coordonnées s'expriment dans l'unité de la planche de
   l'éditeur — 440 × 956, les `SCREEN_WIDTH` / `SCREEN_HEIGHT` de
   `apps/web/src/lib/canvas/canvas-utils`. Elles sont dérivées ici plutôt
   qu'importées : ce module ne doit rien devoir au canevas Fabric, et un
   changement de planche y ferait de toute façon sauter les tests d'export.
*/
const ARTBOARD_WIDTH = 440
const ARTBOARD_HEIGHT = 956

export const AI_LIMITS = {
  /** Le plafond du projet, pas un second plafond qui divergerait du premier. */
  maxScreens: MAX_PROJECT_SCREENS,
  maxLayersPerScreen: 24,
  maxCalls: 200,
  /** Un calque peut déborder de la planche, pas s'en échapper. */
  minCoordinate: -ARTBOARD_WIDTH,
  maxCoordinate: 2 * ARTBOARD_WIDTH,
  minSize: 4,
  maxSize: 2 * ARTBOARD_HEIGHT,
  maxTextLength: 400,
  maxCampaignHeadlineLength: 72,
  maxNameLength: 60,
  maxProductContextLength: 2400,
  maxScreenshotDescriptionLength: 240,
  maxEvidenceLength: 160,
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
  minLength?: number
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
    /* Le contrat du projet accepte un centre décalé depuis toujours ; le schéma
       ne le nommait pas, donc un fond radial centré ailleurs qu'au milieu était
       refusé ici avant d'atteindre la validation qui l'aurait accepté. */
    centerX: { type: 'number', minimum: 0, maximum: 100 },
    centerY: { type: 'number', minimum: 0, maximum: 100 },
  },
  required: ['type'],
  additionalProperties: false,
}

/**
 * Le mot mis en avant dans une accroche, désigné par lui-même.
 *
 * Un passage se nomme (`text`), il ne se repère pas par un couple d'index :
 * l'index est une seconde vérité, qui périme dès que la copie bouge d'un
 * caractère, et un modèle qui écrit « Vois **plus** loin » sait quel mot il
 * vise, pas à quelle colonne il commence. La conversion en positions — points
 * de code, lignes non repliées — appartient au dépôt, qui seul sait comment
 * Fabric compte.
 *
 * Sans ce champ, colorer un mot obligeait à couper l'accroche en trois calques
 * réalignés à la main : mesuré sur une vraie session, 18 calques texte pour 4
 * accroches, dont deux se chevauchaient de 78 px.
 */
const emphasis: ParamSchema = {
  type: 'array',
  maxItems: 4,
  description:
    'Colore un ou plusieurs passages du contenu sans couper le calque. Chaque passage est cherché tel quel dans le texte, à sa première occurrence.',
  items: {
    type: 'object',
    properties: { text: { type: 'string', minLength: 1, maxLength: 80 }, color },
    required: ['text', 'color'],
    additionalProperties: false,
  },
}

const geometry: Record<string, ParamSchema> = {
  x: coordinate,
  y: coordinate,
  width: size,
  height: size,
  /*
     La rotation et l'opacité sont posables à la création, et pas seulement par
     `update_layer`.

     Ce n'est pas une commodité : un plan déterministe construit sa liste
     d'appels **avant** que le premier ne s'exécute, donc il n'a aucun
     identifiant de calque à patcher ensuite. Sans ces deux champs ici, un
     appareil incliné ou une forme d'accent en filigrane étaient hors d'atteinte
     du constructeur — pas parce que l'éditeur ne sait pas les faire, mais parce
     que le vocabulaire ne savait pas les dire. C'est exactement ce que
     l'utilisateur constatait en voyant dix planches identiques et plates.
  */
  rotation: { type: 'number', minimum: -360, maximum: 360 },
  opacity: { type: 'number', minimum: 0, maximum: 1 },
}

function object(
  properties: Record<string, ParamSchema>,
  required: readonly string[] = [],
): ParamSchema {
  return { type: 'object', properties, required, additionalProperties: false }
}

/**
 * Les catalogues fermés dans lesquels les schémas piochent leurs
 * énumérations. Une seule source les déclare — `catalog-ids.ts` — et c'est
 * l'appelant qui les passe : le paquet ne connaît ni les gabarits SVG de
 * l'éditeur ni ses aperçus.
 */
export interface AiToolCatalogs {
  deviceModels: readonly string[]
  shapeIds: readonly string[]
  iconIds: readonly string[]
  fonts: readonly string[]
}

export interface AiTooling {
  AI_TOOLS: readonly ToolSchema[]
  toolSchema: (name: string) => ToolSchema | undefined
  validateToolCall: (call: ToolCall) => string | null
}

/** Construit le vocabulaire d'outils clos sur les catalogues donnés. */
export function createAiTools(catalogs: AiToolCatalogs): AiTooling {
  const AI_TOOLS: readonly ToolSchema[] = [
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
          fontFamily: { type: 'string', enum: catalogs.fonts },
          fontSize: { type: 'number', minimum: 8, maximum: 240 },
          fontWeight: { type: 'integer', minimum: 100, maximum: 900 },
          color,
          textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
          emphasis,
        },
        ['content'],
      ),
    },
    {
      name: 'add_shape',
      description: 'Pose une forme du catalogue.',
      parameters: object(
        {
          screenId,
          shapeType: { type: 'string', enum: catalogs.shapeIds },
          ...geometry,
          fill: color,
        },
        ['shapeType'],
      ),
    },
    {
      name: 'add_icon',
      description: 'Pose une icône du catalogue.',
      parameters: object(
        {
          screenId,
          iconId: { type: 'string', enum: catalogs.iconIds },
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
        deviceModel: { type: 'string', enum: catalogs.deviceModels },
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
            /* `geometry` porte déjà la rotation et l'opacité : les redéclarer ici
               ferait deux définitions du même champ, qui divergeraient. */
            ...geometry,
            visible: { type: 'boolean' },
            content: { type: 'string', maxLength: AI_LIMITS.maxTextLength },
            fontFamily: { type: 'string', enum: catalogs.fonts },
            fontSize: { type: 'number', minimum: 8, maximum: 240 },
            fontWeight: { type: 'integer', minimum: 100, maximum: 900 },
            textAlign: { type: 'string', enum: ['left', 'center', 'right'] },
            emphasis,
            color,
            fill: color,
            shapeType: { type: 'string', enum: catalogs.shapeIds },
            iconId: { type: 'string', enum: catalogs.iconIds },
            deviceModel: { type: 'string', enum: catalogs.deviceModels },
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

  const toolSchema = (name: string): ToolSchema | undefined =>
    AI_TOOLS.find((tool) => tool.name === name)

  /** Refuse un appel avant qu'il n'atteigne le projet. */
  const validateToolCall = (call: ToolCall): string | null => {
    const schema = toolSchema(call.tool)
    if (!schema) return `Outil inconnu : ${String(call.tool)}`
    if (schema.readOnly) return `${call.tool} est en lecture seule`
    return validateAgainst(schema.parameters, call.args ?? {})
  }

  return { AI_TOOLS, toolSchema, validateToolCall }
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
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      return `${path} : ${schema.minLength} caractère au moins`
    }
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
  /* `emphasis` n'est pas une propriété du calque : l'exécuteur la consomme pour
     en dériver `charStyles`, et ne la recopie jamais. Elle est ici parce que
     l'allowlist filtre les clés du patch avant lui — sans elle, le schéma
     accepterait un champ que l'exécuteur refuserait deux lignes plus loin. */
  text: [
    ...COMMON_PATCH,
    'content',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'color',
    'textAlign',
    'emphasis',
  ],
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
