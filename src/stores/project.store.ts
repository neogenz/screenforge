import { create } from 'zustand'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import type { GlobalSettings, Layer, Project, Screen } from '@/types'

export const DEFAULT_GLOBALS: GlobalSettings = {
  fontFamily: 'Space Grotesk',
  fontWeight: 700,
  fontSize: 48,
  fontColor: '#1a1a1a',
  background: { type: 'solid', color: '#ffffff' },
  deviceModel: 'iphone-17-pro-max',
  deviceColor: 'cosmic-orange',
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createDefaultScreen(name: string, globals: GlobalSettings): Screen {
  return {
    id: crypto.randomUUID(),
    name,
    layers: [],
    background: cloneValue(globals.background),
  }
}

function withTimestamp(project: Project, updates: Partial<Project>): Project {
  return {
    ...project,
    ...updates,
    updatedAt: Math.max(Date.now(), project.updatedAt + 1),
  }
}

interface ProjectState {
  project: Project | null

  createProject: (name: string) => void
  loadProject: (project: Project) => void
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
    const globals = cloneValue(DEFAULT_GLOBALS)
    const screen = createDefaultScreen('Screen 1', globals)
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
          layers: cloneValue(content.layers),
          background: cloneValue(content.background),
        }
      : createDefaultScreen(`Screen ${project.screens.length + 1}`, project.globals)
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
        ...cloneValue(source),
        id: crypto.randomUUID(),
        name: `${source.name} copy`,
        layers: source.layers.map((layer) => ({
          ...cloneValue(layer),
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
            globals: { ...state.project.globals, ...cloneValue(globals) },
          }),
        }
      : state),

  updateScreenBackground: (screenId, background) =>
    set((state) => state.project
      ? {
          project: withTimestamp(state.project, {
            screens: state.project.screens.map((screen) => screen.id === screenId
              ? { ...screen, background: cloneValue(background) }
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
          ...cloneValue(layer),
          id: crypto.randomUUID(),
          name: `${layer.name} copy`,
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
                background: cloneValue(background),
                layers: cloneValue(layers),
                thumbnail: undefined,
              }
            : screen),
        }),
      }
    }),
}))
