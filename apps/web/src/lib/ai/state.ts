import { layerDisplayName } from '@/lib/layer-factories'
import { canvasSize } from '@/lib/canvas/canvas-utils'
import { deviceModelIdsForPlatform } from '@screenforge/project-format'
import { getAppStoreProfile, type AppStorePlatform, type AppStoreProfileId } from '@/lib/dimensions'
import type { Layer, Project, Screen } from '@/types'

/**
 * Ce qu'un modèle a le droit de voir du projet.
 *
 * Jamais l'état vivant, jamais un objet Fabric, jamais une data URL : une
 * capture d'écran d'application pèse des mégaoctets en base64, et l'envoyer à
 * un fournisseur tiers serait une fuite décidée par personne. Un asset n'est
 * donc décrit que par sa présence et ses dimensions — c'est tout ce dont un
 * plan a besoin pour raisonner sur un cadrage.
 *
 * La sortie est du JSON plat, borné et relisible : c'est ce qui part dans une
 * requête, donc ce qui doit tenir dans une revue de sécurité en une lecture.
 */

export interface LayerView {
  id: string
  type: Layer['type']
  name: string
  x: number
  y: number
  width: number
  height: number
  visible: boolean
  locked: boolean
  /** Texte du calque, tronqué : le modèle a besoin du sens, pas du roman. */
  content?: string
  slot?: string
  /** Vrai si une capture est posée. L'image elle-même ne sort jamais d'ici. */
  hasScreenshot?: boolean
}

export interface ScreenView {
  id: string
  name: string
  rank: number
  background: Screen['background']
  layers: LayerView[]
}

export interface ProjectView {
  name: string
  profile: {
    id: AppStoreProfileId
    platform: AppStorePlatform
    name: string
    width: number
    height: number
  }
  deviceModels: readonly Project['globals']['deviceModel'][]
  canvas: { width: number; height: number }
  globals: Project['globals']
  screens: ScreenView[]
  layoutLayers: LayerView[]
}

const MAX_CONTENT = 200

function layerView(layer: Layer): LayerView {
  const view: LayerView = {
    id: layer.id,
    type: layer.type,
    name: layerDisplayName(layer),
    x: Math.round(layer.x),
    y: Math.round(layer.y),
    width: Math.round(layer.width),
    height: Math.round(layer.height),
    visible: layer.visible,
    locked: layer.locked,
  }
  if (layer.type === 'text') view.content = layer.content.slice(0, MAX_CONTENT)
  if (layer.type === 'device-frame') {
    view.slot = layer.slot
    view.hasScreenshot = Boolean(layer.screenshotAssetId)
  }
  return view
}

export function screenView(screen: Screen, rank: number): ScreenView {
  return {
    id: screen.id,
    name: screen.name,
    rank,
    background: structuredClone(screen.background),
    layers: screen.layers.map(layerView),
  }
}

/** Réponse de `get_project_state`. */
export function describeProject(project: Project): ProjectView {
  const size = canvasSize(project.profileId)
  const profile = getAppStoreProfile(project.profileId)!
  return {
    name: project.name,
    profile: {
      id: profile.id,
      platform: profile.platform,
      name: profile.name,
      width: profile.portrait.width,
      height: profile.portrait.height,
    },
    deviceModels: deviceModelIdsForPlatform(profile.platform),
    canvas: size,
    globals: structuredClone(project.globals),
    screens: project.screens.map(screenView),
    layoutLayers: project.layoutLayers.map(layerView),
  }
}

/** Réponse de `get_screen`. */
export function describeScreen(project: Project, screenId: string): ScreenView | undefined {
  const rank = project.screens.findIndex((screen) => screen.id === screenId)
  return rank < 0 ? undefined : screenView(project.screens[rank], rank)
}
