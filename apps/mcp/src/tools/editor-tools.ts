import {
  fromJsonSchema,
  type CallToolResult,
  type JsonSchemaType,
  type jsonSchemaValidator,
  type McpServer,
} from '@modelcontextprotocol/server'
import {
  AI_LIMITS,
  CONTENT_FONTS,
  createAiTools,
  DEVICE_MODEL_IDS,
  ICON_IDS,
  SHAPE_IDS,
  validateAgainst,
  type ParamSchema,
  type ToolCall,
} from '@screenforge/project-format'
import type { RelayState } from '../relay/server.ts'
import type { RelaySession } from '../relay/session.ts'
import { AssetRefusedError } from '../relay/assets.ts'
import { readProjectState, readScreen } from './get-state.ts'
import { ADD_IMAGE_SCHEMA, planAddImage, type AddImageArgs } from './add-image.ts'
import { renderThumbnail, THUMBNAIL_SCHEMA } from './get-thumbnail.ts'
import {
  listTemplates,
  LIST_TEMPLATES_SCHEMA,
  saveTemplate,
  SAVE_TEMPLATE_SCHEMA,
} from './templates.ts'

/**
 * Un outil MCP par entrée du contrat, et pas une ligne de schéma réécrite.
 *
 * `AI_TOOLS` est déjà le vocabulaire fermé que l'éditeur accepte : catalogues
 * énumérés, bornes numériques, `additionalProperties: false` partout. Le
 * publier tel quel sur MCP n'est pas une commodité — c'est ce qui garantit que
 * le schéma annoncé à l'agent et le schéma revalidé à l'arrivée dans le
 * navigateur sont le même objet. Un schéma recopié ici aurait dérivé au premier
 * outil ajouté, et la dérive aurait pris la forme d'un appel accepté par le
 * démon puis refusé par la page, sans que rien ne dise pourquoi.
 *
 * Le préfixe `screenforge_` est là parce qu'un agent voit les outils de tous
 * ses serveurs à plat : `add_text` seul ne dit pas à quoi il ajoute du texte.
 */

const TOOL_PREFIX = 'screenforge_'

const { AI_TOOLS, toolSchema, validateToolCall } = createAiTools({
  deviceModels: DEVICE_MODEL_IDS,
  shapeIds: SHAPE_IDS,
  iconIds: ICON_IDS,
  fonts: CONTENT_FONTS,
})

const WRITABLE = AI_TOOLS.filter((tool) => !tool.readOnly)

function text(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] }
}

function refuse(detail: string): CallToolResult {
  return { content: [{ type: 'text', text: detail }], isError: true }
}

/**
 * Le sous-schéma que l'appel a violé, joint au refus.
 *
 * `validateAgainst` dit « args.iconId : valeur hors catalogue », ce qui suffit
 * à un humain devant une liste déroulante et pas à un agent qui doit corriger
 * son appel sans la voir. Le sous-schéma porte l'énumération, les bornes et le
 * motif : c'est la réponse à « qu'est-ce qui était attendu ». Il n'est joint
 * qu'au refus, et l'enrichissement vit ici plutôt que dans le validateur
 * partagé — dans le navigateur, le même message part dans une infobulle, où
 * cinquante familles de police ne sont pas une aide.
 */
function schemaAtPath(root: ParamSchema, path: string): ParamSchema | undefined {
  let current: ParamSchema | undefined = root
  for (const step of path.split('.').slice(1)) {
    if (!current) return undefined
    const [key, ...indexes] = step.split('[')
    current = current.properties?.[key ?? '']
    for (let index = 0; index < indexes.length && current; index += 1) current = current.items
  }
  return current
}

function explain(root: ParamSchema, error: string): string {
  const [path] = error.split(' : ')
  const offending = path ? schemaAtPath(root, path) : undefined
  return offending ? `${error}. Attendu : ${JSON.stringify(offending)}` : error
}

/**
 * Le validateur du contrat, branché dans le SDK à la place du sien.
 *
 * Le SDK compile les schémas avec ajv et refuse un appel avant que le
 * gestionnaire ne le voie — ce qui est le bon ordre, mais avec un message qui
 * n'est pas celui que l'éditeur rendrait. Or c'est exactement ce que le paquet
 * partagé existe pour éviter : deux validateurs sur un seul contrat finissent
 * par ne pas être d'accord, et le désaccord prend la forme d'un appel accepté
 * ici puis refusé dans le navigateur. `validateAgainst` est celui que la page
 * exécute ; c'est donc lui qui doit répondre.
 */
const contractValidator: jsonSchemaValidator = {
  getValidator<T>(schema: JsonSchemaType) {
    const root = schema as ParamSchema
    return (input: unknown) => {
      const error = validateAgainst(root, input ?? {})
      return error
        ? { valid: false as const, data: undefined, errorMessage: explain(root, error) }
        : { valid: true as const, data: input as T, errorMessage: undefined }
    }
  },
}

/** Valide un lot entier avant d'en envoyer la moindre partie. */
function reject(calls: readonly ToolCall[]): string | null {
  if (calls.length === 0) return 'Aucun appel : le lot est vide.'
  if (calls.length > AI_LIMITS.maxCalls) return `${AI_LIMITS.maxCalls} appels au plus par lot.`
  for (const [index, call] of calls.entries()) {
    const error = validateToolCall(call)
    if (!error) continue
    const schema = toolSchema(call.tool)
    return `Appel ${index + 1} (${call.tool}) refusé — ${schema ? explain(schema.parameters, error) : error}`
  }
  return null
}

async function relay(session: RelaySession, calls: ToolCall[]): Promise<CallToolResult> {
  const refusal = reject(calls)
  if (refusal) return refuse(refusal)
  try {
    return text(await session.dispatch({ calls }))
  } catch (error) {
    return refuse(error instanceof Error ? error.message : 'Appel interrompu.')
  }
}

const BATCH_SCHEMA: ParamSchema = {
  type: 'object',
  description:
    'Applique plusieurs appels en une seule écriture : une transaction, une seule annulation.',
  properties: {
    calls: {
      type: 'array',
      maxItems: AI_LIMITS.maxCalls,
      items: {
        type: 'object',
        properties: {
          tool: { type: 'string', enum: WRITABLE.map((tool) => tool.name) },
          /* Volontairement sans `properties` : les arguments sont validés par
             le schéma de leur propre outil, juste après. Les décrire une
             seconde fois ici serait la duplication que ce module évite — c'est
             aussi pourquoi ce schéma-ci garde le validateur du SDK, qui laisse
             passer un objet libre là où `validateAgainst` refuserait toute clé
             non déclarée. */
          args: { type: 'object', description: 'Arguments de l’outil visé.' },
        },
        required: ['tool', 'args'],
        additionalProperties: false,
      },
    },
  },
  required: ['calls'],
  additionalProperties: false,
}

export function registerEditorTools(server: McpServer, state: RelayState): void {
  const session = state.session
  for (const tool of AI_TOOLS) {
    /* `add_image` du contrat exige un `assetId` déjà enregistré dans la page :
       un agent n'a aucun moyen d'en produire un, donc le publier tel quel
       serait publier un outil qui ne peut pas aboutir. La version qui prend un
       chemin local le remplace sous le même nom, plus bas — remplacé et non
       ajouté, sans quoi deux outils homonymes se disputeraient le catalogue. */
    if (tool.name === 'add_image') continue
    server.registerTool(
      `${TOOL_PREFIX}${tool.name}`,
      {
        description: tool.description,
        inputSchema: fromJsonSchema<Record<string, unknown>>(tool.parameters, contractValidator),
        annotations: { readOnlyHint: Boolean(tool.readOnly) },
      },
      async (args) => {
        if (tool.name === 'get_project_state') return read(() => readProjectState(session))
        if (tool.name === 'get_screen') {
          return read(() => readScreen(session, String(args.screenId)))
        }
        return relay(session, [{ tool: tool.name, args }])
      },
    )
  }

  /**
   * Le lot, et pourquoi il n'est pas qu'une commodité.
   *
   * La page applique un lot par `commitAiRun`, donc en une transaction validée
   * et une seule étape d'annulation. Dix appels séparés seraient dix écritures
   * et dix annulations, et un refus au sixième laisserait cinq écrans à
   * moitié composés dans le projet de l'utilisateur.
   */
  server.registerTool(
    `${TOOL_PREFIX}apply`,
    {
      description:
        'Applique un lot d’appels en une seule écriture validée, annulable d’un seul Ctrl+Z.',
      inputSchema: fromJsonSchema<{ calls: ToolCall[] }>(BATCH_SCHEMA),
      annotations: { readOnlyHint: false },
    },
    async ({ calls }) => relay(session, calls),
  )

  /**
   * La boucle de retour, sans laquelle l'agent compose à l'aveugle.
   *
   * Déclaré `readOnlyHint` parce qu'il ne l'est pas qu'en intention : la page
   * rend sur un `StaticCanvas` jetable et ne touche ni au projet, ni à
   * l'historique, ni à la sélection. Un agent qui relit un écran après chaque
   * lot ne doit pas empiler dix pas d'annulation pour l'avoir regardé.
   */
  server.registerTool(
    `${TOOL_PREFIX}get_thumbnail`,
    {
      description: 'Rend un écran du projet ouvert en PNG, pour vérifier ce qui vient d’être posé.',
      inputSchema: fromJsonSchema<{ screenId?: string; maxWidth?: number }>(
        THUMBNAIL_SCHEMA,
        contractValidator,
      ),
      annotations: { readOnlyHint: true },
    },
    async (args) => renderThumbnail(session, args),
  )

  /**
   * Le seul outil qui touche au disque, et il ne le fait qu'une fois.
   *
   * Le chemin entre dans le coffre et n'en ressort pas : l'appel qui part vers
   * la page porte un identifiant, et la page le récupère par `GET /asset/:id`.
   * C'est pour cela que cet outil ne relaie pas directement — il traduit
   * d'abord un chemin local en un appel du contrat, puis passe par le même
   * `relay` que tout le reste, donc par la même validation.
   */
  server.registerTool(
    `${TOOL_PREFIX}add_image`,
    {
      description:
        'Pose une image locale de l’utilisateur : un logo (role « image ») ou une capture dans un cadre iPhone (role « screenshot »). Donnez un chemin absolu.',
      inputSchema: fromJsonSchema<AddImageArgs>(ADD_IMAGE_SCHEMA, contractValidator),
      annotations: { readOnlyHint: false },
    },
    async (args) => {
      try {
        return await relay(session, [await planAddImage(state.assets, args)])
      } catch (error) {
        return refuse(
          error instanceof AssetRefusedError
            ? error.message
            : `Image refusée : ${error instanceof Error ? error.message : 'cause inconnue'}.`,
        )
      }
    },
  )

  /**
   * Le seul produit d'une session qui survive au projet.
   *
   * Enregistrer n'écrit pas dans le projet — c'est pourquoi ces deux-là ne
   * passent pas par `relay` : ils ne portent aucun appel du contrat, ne sont pas
   * validés par `validateToolCall` et ne coûtent aucun pas d'annulation. La
   * bibliothèque vit dans l'IndexedDB de l'onglet, hors des projets, ce qui est
   * exactement ce qui la rend réutilisable dans le suivant.
   */
  server.registerTool(
    `${TOOL_PREFIX}save_template`,
    {
      description:
        'Enregistre la mise en page d’un écran comme gabarit réutilisable, images comprises, capture d’écran exclue.',
      inputSchema: fromJsonSchema<{ name: string; description?: string; screenId?: string }>(
        SAVE_TEMPLATE_SCHEMA,
        contractValidator,
      ),
      annotations: { readOnlyHint: false },
    },
    async (args) => saveTemplate(session, args),
  )

  server.registerTool(
    `${TOOL_PREFIX}list_templates`,
    {
      description: 'Liste les gabarits enregistrés sur ce navigateur, tous projets confondus.',
      inputSchema: fromJsonSchema<Record<string, never>>(LIST_TEMPLATES_SCHEMA, contractValidator),
      annotations: { readOnlyHint: true },
    },
    async () => listTemplates(session),
  )
}

function read(reader: () => unknown): CallToolResult {
  try {
    return text(reader())
  } catch (error) {
    return refuse(error instanceof Error ? error.message : 'Lecture impossible.')
  }
}
