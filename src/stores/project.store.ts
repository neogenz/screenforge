import { create } from 'zustand'
import { getDeviceFrame } from '@/assets/device-frames'
import { DEFAULT_INK_COLOR, DEFAULT_SOLID_COLOR } from '@/lib/content-defaults'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { nextTimestamp } from '@/lib/time'
import { POPULAR_FONTS } from '@/lib/fonts'
import { defaultScreenName } from '@/lib/screens'
import type { DeviceModel, GlobalSettings, Layer, Project, Screen } from '@/types'

const DEFAULT_DEVICE_MODEL: DeviceModel = 'iphone-17-pro-max'

// Les réglages globaux l'emportent sur les fabriques de calques : tout défaut
// posé ici est ce que l'utilisateur voit réellement en ajoutant un calque.
// Ils dérivent donc des mêmes sources uniques, jamais de valeurs recopiées.
export const DEFAULT_GLOBALS: GlobalSettings = {
  fontFamily: POPULAR_FONTS[0],
  fontWeight: 700,
  fontSize: 48,
  fontColor: DEFAULT_INK_COLOR,
  background: { type: 'solid', color: DEFAULT_SOLID_COLOR },
  deviceModel: DEFAULT_DEVICE_MODEL,
  deviceColor: getDeviceFrame(DEFAULT_DEVICE_MODEL).colors[0].name,
}

export function createDefaultScreen(name: string, globals: GlobalSettings): Screen {
  return {
    id: crypto.randomUUID(),
    name,
    layers: [],
    background: structuredClone(globals.background),
  }
}

function withTimestamp(project: Project, updates: Partial<Project>): Project {
  return {
    ...project,
    ...updates,
    updatedAt: nextTimestamp(project.updatedAt),
  }
}

export function getActiveScreen(project: Project | null): Screen | undefined {
  return project?.screens.find((screen) => screen.id === project.activeScreenId)
    ?? project?.screens[0]
}

export function getProjectLayers(project: Project | null): Layer[] {
  const screen = getActiveScreen(project)
  return [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])]
}

interface ProjectState {
  project: Project | null

  createProject: (name: string) => void
  loadProject: (project: Project) => void
  setActiveScreenId: (id: string) => void
  updateProjectName: (name: string) => void
  addScreen: (content?: Pick<Screen, 'name' | 'layers' | 'background'>) => string | null
  removeScreen: (id: string) => string | null
  duplicateScreen: (id: string) => string | null
  renameScreen: (id: string, name: string) => void
  reorderScreens: (ids: string[]) => void
  updateGlobals: (globals: Partial<GlobalSettings>) => void
  updateScreenBackground: (screenId: string, background: Screen['background']) => void
  saveScreenLayers: (screenId: string, layers: Screen['layers']) => void
  saveLayoutLayers: (layers: Layer[]) => void
  addScreenLayer: (screenId: string, layer: Layer) => void
  removeScreenLayer: (screenId: string, layerId: string) => void
  updateScreenLayer: (screenId: string, layerId: string, updates: Partial<Layer>) => void
  reorderScreenLayer: (screenId: string, layerId: string, newIndex: number) => void
  duplicateScreenLayer: (screenId: string, layerId: string) => void
  replaceScreenContent: (screenId: string, background: Screen['background'], layers: Layer[]) => void
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: null,

  createProject: (name) => {
    const now = Date.now()
    const globals = structuredClone(DEFAULT_GLOBALS)
    const screen = createDefaultScreen(defaultScreenName(0), globals)
    set({
      project: {
        id: crypto.randomUUID(),
        name,
        screens: [screen],
        activeScreenId: screen.id,
        globals,
        layoutLayers: [],
        createdAt: now,
        updatedAt: now,
      },
    })
  },

  loadProject: (project) => set({ project }),

  setActiveScreenId: (id) =>
    set((state) => {
      if (!state.project || state.project.activeScreenId === id) return state
      if (!state.project.screens.some((screen) => screen.id === id)) return state
      return { project: withTimestamp(state.project, { activeScreenId: id }) }
    }),

  renameScreen: (id, name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!state.project || !trimmed) return state
      return {
        project: withTimestamp(state.project, {
          screens: state.project.screens.map((screen) =>
            screen.id === id ? { ...screen, name: trimmed } : screen,
          ),
        }),
      }
    }),

  updateProjectName: (name) =>
    set((state) => state.project
      ? { project: withTimestamp(state.project, { name }) }
      : state),

  addScreen: (content) => {
    const project = get().project
    if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return null
    const screen = content
      ? {
          id: crypto.randomUUID(),
          name: content.name,
          layers: structuredClone(content.layers),
          background: structuredClone(content.background),
        }
      : createDefaultScreen(defaultScreenName(project.screens.length), project.globals)
    set({
      project: withTimestamp(project, {
        screens: [...project.screens, screen],
        activeScreenId: screen.id,
      }),
    })
    return screen.id
  },

  removeScreen: (id) => {
    const project = get().project
    if (!project || project.screens.length <= 1) return null
    const index = project.screens.findIndex((screen) => screen.id === id)
    if (index === -1) return null
    const screens = project.screens.filter((screen) => screen.id !== id)
    const activeScreenId = project.activeScreenId !== id
      && screens.some((screen) => screen.id === project.activeScreenId)
      ? project.activeScreenId
      : screens[Math.min(index, screens.length - 1)].id
    set({ project: withTimestamp(project, { screens, activeScreenId }) })
    return activeScreenId
  },

  duplicateScreen: (id) => {
      const project = get().project
      if (!project || project.screens.length >= MAX_PROJECT_SCREENS) return null
      const sourceIndex = project.screens.findIndex((screen) => screen.id === id)
      if (sourceIndex === -1) return null
      const source = project.screens[sourceIndex]
      const duplicate: Screen = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        name: `${source.name} copie`,
        layers: source.layers.map((layer) => ({
          ...structuredClone(layer),
          id: crypto.randomUUID(),
        })),
        thumbnail: undefined,
      }
      const screens = [...project.screens]
      screens.splice(sourceIndex + 1, 0, duplicate)
      set({
        project: withTimestamp(project, {
          screens,
          activeScreenId: duplicate.id,
        }),
      })
      return duplicate.id
  },

  reorderScreens: (ids) =>
    set((state) => {
      if (!state.project) return state
      const byId = new Map(state.project.screens.map((screen) => [screen.id, screen]))
      const screens = ids.flatMap((id) => {
        const screen = byId.get(id)
        if (!screen) return []
        byId.delete(id)
        return [screen]
      })
      screens.push(...byId.values())
      const unchanged = screens.every((screen, index) => screen === state.project?.screens[index])
      return unchanged ? state : { project: withTimestamp(state.project, { screens }) }
    }),

  updateGlobals: (globals) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            globals: { ...state.project.globals, ...structuredClone(globals) },
          }),
        }
      : state),

  updateScreenBackground: (screenId, background) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? { ...screen, background: structuredClone(background) }
              : screen),
          }),
        }
      : state),

  saveScreenLayers: (screenId, layers) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? { ...screen, layers }
              : screen),
          }),
        }
      : state),

  saveLayoutLayers: (layers) =>
    set((state) => state.project
      ? { project: withTimestamp(state.project, { layoutLayers: layers }) }
      : state),

  addScreenLayer: (screenId, layer) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? { ...screen, layers: [...screen.layers, layer] }
              : screen),
          }),
        }
      : state),

  removeScreenLayer: (screenId, layerId) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? { ...screen, layers: screen.layers.filter((layer) => layer.id !== layerId) }
              : screen),
          }),
        }
      : state),

  updateScreenLayer: (screenId, layerId, updates) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? {
                  ...screen,
                  layers: screen.layers.map((layer) => layer.id === layerId
                    ? { ...layer, ...updates } as Layer
                    : layer),
                }
              : screen),
          }),
        }
      : state),

  reorderScreenLayer: (screenId, layerId, newIndex) =>
    set((state) => {
      if (!state.project) return state
      const screens = state.project.screens.map((screen) => {
        if (screen.id !== screenId) return screen
        const layers = [...screen.layers]
        const currentIndex = layers.findIndex((layer) => layer.id === layerId)
        if (currentIndex === -1) return screen
        const [moved] = layers.splice(currentIndex, 1)
        const targetIndex = Math.max(0, Math.min(newIndex, layers.length))
        layers.splice(targetIndex, 0, moved)
        return {
          ...screen,
          layers: layers.map((layer, index) => ({ ...layer, zIndex: index })),
        }
      })
      return { project: withTimestamp(state.project, { screens }) }
    }),

  duplicateScreenLayer: (screenId, layerId) =>
    set((state) => {
      if (!state.project) return state
      const screens = state.project.screens.map((screen) => {
        if (screen.id !== screenId) return screen
        const layer = screen.layers.find((candidate) => candidate.id === layerId)
        if (!layer) return screen
        const duplicate: Layer = {
          ...structuredClone(layer),
          id: crypto.randomUUID(),
          name: `${layer.name} copie`,
          x: layer.x + 16,
          y: layer.y + 16,
          zIndex: screen.layers.length,
        }
        return { ...screen, layers: [...screen.layers, duplicate] }
      })
      return { project: withTimestamp(state.project, { screens }) }
    }),

  replaceScreenContent: (screenId, background, layers) =>
    set((state) => {
      if (!state.project || !state.project.screens.some((screen) => screen.id === screenId)) {
        return state
      }
      return {
        project: withTimestamp(state.project, {
          activeScreenId: screenId,
          screens: state.project.screens.map((screen) => screen.id === screenId
            ? {
                ...screen,
                background: structuredClone(background),
                layers: structuredClone(layers),
                thumbnail: undefined,
              }
            : screen),
        }),
      }
    }),
}))
