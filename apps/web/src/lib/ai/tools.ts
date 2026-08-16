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
import { setRangeFill } from '@/lib/text-styles'
import {
  AI_LIMITS,
  CONTENT_FONTS,
  createAiTools,
  DEVICE_MODEL_IDS,
  ICON_IDS,
  PATCHABLE_PROPS,
  SHAPE_IDS,
  validateAgainst,
} from '@screenforge/project-format'
import type {
  ExecutionOutcome,
  ParamSchema,
  ToolCall,
  ToolContext,
  ToolName,
  ToolResult,
  ToolSchema,
} from '@screenforge/project-format'
import type { Background, DeviceModel, Layer, Project, Screen, TextCharStyles } from '@/types'

/**
 * Ce qu'un modèle peut faire au projet, et rien d'autre.
 *
 * Le principe de la phase : **le modèle décide, le dépôt écrit**. Aucun outil
 * n'accepte de JSON Fabric, d'image aplatie ni d'accès générique aux stores —
 * chacun appelle les mêmes fabriques que les boutons de la barre d'outils, et
 * produit donc des calques ScreenForge ordinaires, éditables et exportables.
 * Un modèle qui déraille peut au pire poser un texte au mauvais endroit.
 *
 * La partie déclarative du contrat — schémas, bornes, validation d'appel —
 * vit dans `@screenforge/project-format` (`src/ai-tools.ts`), partagée avec le
 * démon MCP : le schéma envoyé à un fournisseur et le schéma revalidé à
 * l'arrivée sont la même source. Ici ne reste que l'exécution, qui touche les
 * fabriques de l'éditeur.
 */

const { AI_TOOLS, toolSchema, validateToolCall } = createAiTools({
  deviceModels: DEVICE_MODEL_IDS,
  shapeIds: SHAPE_IDS,
  iconIds: ICON_IDS,
  fonts: CONTENT_FONTS,
})

export { AI_LIMITS, AI_TOOLS, PATCHABLE_PROPS, toolSchema, validateAgainst, validateToolCall }
export type {
  ExecutionOutcome,
  ParamSchema,
  ToolCall,
  ToolContext,
  ToolName,
  ToolResult,
  ToolSchema,
}

function findLayer(draft: Project, id: string): { layer: Layer; screen?: Screen } | undefined {
  for (const screen of draft.screens) {
    const layer = screen.layers.find((candidate) => candidate.id === id)
    if (layer) return { layer, screen }
  }
  const shared = draft.layoutLayers.find((candidate) => candidate.id === id)
  return shared ? { layer: shared } : undefined
}

/** Le seul endroit qui pose la géométrie d'un calque créé — les cinq `add_*`. */
function place(layer: Layer, args: Record<string, unknown>): Layer {
  for (const key of ['x', 'y', 'width', 'height', 'rotation', 'opacity'] as const) {
    if (typeof args[key] === 'number') layer[key] = args[key]
  }
  return layer
}

/**
 * Le modèle nomme le mot, le dépôt calcule les index.
 *
 * `emphasis` désigne un passage par son texte ; `setRangeFill` veut des
 * positions en **points de code**, sur les lignes que sépare un `\n`. La
 * conversion tient en une ligne (`[...content.slice(0, at)].length`) et doit
 * vivre ici : `indexOf` compte en unités UTF-16, donc une accroche portant un
 * emoji avant le passage décalerait la couleur d'un cran par emoji.
 *
 * Seule la **première** occurrence est peinte. Colorer toutes les occurrences
 * ferait d'un « et » emphatique un texte bariolé, et le modèle n'aurait aucun
 * moyen de dire lequel il visait — la règle est donc énoncée dans le schéma
 * plutôt que devinée.
 *
 * Un passage introuvable refuse le lot entier au lieu d'être ignoré : un
 * exergue silencieusement perdu rendrait « posé » un calque que l'agent croit
 * coloré, et il ne le revérifierait jamais.
 */
function resolveEmphasis(
  content: string,
  passages: readonly unknown[],
): { charStyles?: TextCharStyles } | { error: string } {
  let charStyles: TextCharStyles | undefined
  for (const passage of passages) {
    const { text, color } = passage as { text: string; color: string }
    const at = content.indexOf(text)
    if (at < 0) {
      return { error: `Passage absent du texte : « ${text} » n’est pas dans « ${content} »` }
    }
    const start = [...content.slice(0, at)].length
    charStyles = setRangeFill(content, charStyles, start, start + [...text].length, color)
  }
  return { charStyles }
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
        if (Array.isArray(args.emphasis)) {
          const resolved = resolveEmphasis(layer.content, args.emphasis)
          if ('error' in resolved) return { results, error: resolved.error }
          if (resolved.charStyles) layer.charStyles = resolved.charStyles
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
          // `emphasis` n'est pas une propriété : elle se résout après le patch,
          // sur le contenu **final**, sans quoi elle viserait l'ancien texte.
          if (key === 'emphasis') continue
          ;(found.layer as unknown as Record<string, unknown>)[key] = value
        }
        /* Un contenu remplacé sans exergue perd ses couleurs plutôt que de les
           garder sur les colonnes d'un texte qui n'existe plus : elles y
           tomberaient au milieu de mots, ce que personne n'a demandé et que
           rien n'annoncerait. */
        if (found.layer.type === 'text' && ('emphasis' in patch || 'content' in patch)) {
          const resolved = resolveEmphasis(
            found.layer.content,
            Array.isArray(patch.emphasis) ? patch.emphasis : [],
          )
          if ('error' in resolved) return { results, error: resolved.error }
          if (resolved.charStyles) found.layer.charStyles = resolved.charStyles
          else delete found.layer.charStyles
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
