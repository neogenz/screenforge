import { create } from 'zustand'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import type { GlobalSettings, Layer, Project, Screen } from '@/types'

export const DEFAULT_GLOBALS: GlobalSettings = {
  fontFamily: 'Barlow',
  fontWeight: 700,
  fontSize: 48,
  fontColor: '#1a1a1a',
  background: { type: 'solid', color: '#ffffff' },
  deviceModel: 'iphone-16-pro-max',
  deviceColor: 'black-titanium',
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
  return { ...project, ...updates, updatedAt: Date.now() }
}

interface ProjectState {
  project: Project | null

  createProject: (name: string) => void
  loadProject: (project: Project) => void
  updateProjectName: (name: string) => void
  addScreen: () => void
  removeScreen: (id: string) => void
  duplicateScreen: (id: string) => void
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
}

export const useProjectStore = create<ProjectState>()((set) => ({
  project: null,

  createProject: (name) => {
    const now = Date.now()
    const globals = cloneValue(DEFAULT_GLOBALS)
    set({
      project: {
        id: crypto.randomUUID(),
        name,
        screens: [createDefaultScreen('Screen 1', globals)],
        globals,
        layoutLayers: [],
        createdAt: now,
        updatedAt: now,
      },
    })
  },

  loadProject: (project) => set({ project }),

  updateProjectName: (name) =>
    set((state) => state.project
      ? { project: withTimestamp(state.project, { name }) }
      : state),

  addScreen: () =>
    set((state) => {
      if (!state.project || state.project.screens.length >= MAX_PROJECT_SCREENS) return state
      const screen = createDefaultScreen(
        `Screen ${state.project.screens.length + 1}`,
        state.project.globals,
      )
      return {
        project: withTimestamp(state.project, {
          screens: [...state.project.screens, screen],
        }),
      }
    }),

  removeScreen: (id) =>
    set((state) => {
      if (!state.project || state.project.screens.length <= 1) return state
      const screens = state.project.screens.filter((screen) => screen.id !== id)
      if (screens.length === state.project.screens.length) return state
      return { project: withTimestamp(state.project, { screens }) }
    }),

  duplicateScreen: (id) =>
    set((state) => {
      if (!state.project || state.project.screens.length >= MAX_PROJECT_SCREENS) return state
      const sourceIndex = state.project.screens.findIndex((screen) => screen.id === id)
      if (sourceIndex === -1) return state
      const source = state.project.screens[sourceIndex]
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
      const screens = [...state.project.screens]
      screens.splice(sourceIndex + 1, 0, duplicate)
      return { project: withTimestamp(state.project, { screens }) }
    }),

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
      return { project: withTimestamp(state.project, { screens }) }
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
}))
