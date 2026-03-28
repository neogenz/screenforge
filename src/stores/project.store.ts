import { create } from 'zustand'
import type { Project, Screen, GlobalSettings, Layer } from '@/types'

const DEFAULT_GLOBALS: GlobalSettings = {
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: 48,
  fontColor: '#1a1a1a',
  background: { type: 'solid', color: '#ffffff' },
  deviceModel: 'iphone-16-pro-max',
  deviceColor: 'black-titanium',
}

function createScreen(name: string, globals: GlobalSettings): Screen {
  return {
    id: crypto.randomUUID(),
    name,
    layers: [],
    background: globals.background,
  }
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
  setActiveScreen: (id: string) => void
  updateGlobals: (globals: Partial<GlobalSettings>) => void
  updateScreenBackground: (screenId: string, background: Screen['background']) => void
  saveScreenLayers: (screenId: string, layers: Screen['layers']) => void
  saveLayoutLayers: (layers: Layer[]) => void

  // Per-screen layer CRUD
  addScreenLayer: (screenId: string, layer: Layer) => void
  removeScreenLayer: (screenId: string, layerId: string) => void
  updateScreenLayer: (screenId: string, layerId: string, updates: Partial<Layer>) => void
  reorderScreenLayer: (screenId: string, layerId: string, newIndex: number) => void
  duplicateScreenLayer: (screenId: string, layerId: string) => void
}

export const useProjectStore = create<ProjectState>()((set) => ({
  project: null,

  createProject: (name) => {
    const firstScreen = createScreen('Screen 1', DEFAULT_GLOBALS)
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      screens: [firstScreen],
      globals: { ...DEFAULT_GLOBALS },
      layoutLayers: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set({ project })
  },

  loadProject: (project) => set({ project }),

  updateProjectName: (name) =>
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, name, updatedAt: Date.now() } }
    }),

  addScreen: () =>
    set((state) => {
      if (!state.project) return state
      const { screens, globals } = state.project
      const newScreen = createScreen(`Screen ${screens.length + 1}`, globals)
      return {
        project: {
          ...state.project,
          screens: [...screens, newScreen],
          updatedAt: Date.now(),
        },
      }
    }),

  removeScreen: (id) =>
    set((state) => {
      if (!state.project) return state
      const { screens } = state.project
      if (screens.length <= 1) return state  // prevent deleting last screen
      return {
        project: {
          ...state.project,
          screens: screens.filter((s) => s.id !== id),
          updatedAt: Date.now(),
        },
      }
    }),

  duplicateScreen: (id) =>
    set((state) => {
      if (!state.project) return state
      const { screens } = state.project
      const source = screens.find((s) => s.id === id)
      if (!source) return state
      const duplicate: Screen = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} copy`,
        layers: source.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
      }
      const sourceIndex = screens.findIndex((s) => s.id === id)
      const newScreens = [...screens]
      newScreens.splice(sourceIndex + 1, 0, duplicate)
      return {
        project: {
          ...state.project,
          screens: newScreens,
          updatedAt: Date.now(),
        },
      }
    }),

  reorderScreens: (ids) =>
    set((state) => {
      if (!state.project) return state
      const { screens } = state.project
      const reordered = ids
        .map((id) => screens.find((s) => s.id === id))
        .filter((s): s is Screen => s !== undefined)
      return {
        project: {
          ...state.project,
          screens: reordered,
          updatedAt: Date.now(),
        },
      }
    }),

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setActiveScreen: (_screenId) => {
    // Active screen tracking lives in canvas.store — this is a no-op passthrough
  },

  updateGlobals: (globals) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          globals: { ...state.project.globals, ...globals },
          updatedAt: Date.now(),
        },
      }
    }),

  updateScreenBackground: (screenId, background) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) =>
            s.id === screenId ? { ...s, background } : s
          ),
          updatedAt: Date.now(),
        },
      }
    }),

  saveScreenLayers: (screenId, layers) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) =>
            s.id === screenId ? { ...s, layers } : s
          ),
          updatedAt: Date.now(),
        },
      }
    }),

  saveLayoutLayers: (layers) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          layoutLayers: layers,
          updatedAt: Date.now(),
        },
      }
    }),

  addScreenLayer: (screenId, layer) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) =>
            s.id === screenId ? { ...s, layers: [...s.layers, layer] } : s
          ),
          updatedAt: Date.now(),
        },
      }
    }),

  removeScreenLayer: (screenId, layerId) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) =>
            s.id === screenId
              ? { ...s, layers: s.layers.filter((l) => l.id !== layerId) }
              : s
          ),
          updatedAt: Date.now(),
        },
      }
    }),

  updateScreenLayer: (screenId, layerId, updates) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) =>
            s.id === screenId
              ? {
                  ...s,
                  layers: s.layers.map((l) =>
                    l.id === layerId ? ({ ...l, ...updates } as Layer) : l
                  ),
                }
              : s
          ),
          updatedAt: Date.now(),
        },
      }
    }),

  reorderScreenLayer: (screenId, layerId, newIndex) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) => {
            if (s.id !== screenId) return s
            const layers = [...s.layers]
            const idx = layers.findIndex((l) => l.id === layerId)
            if (idx === -1) return s
            const [removed] = layers.splice(idx, 1)
            layers.splice(newIndex, 0, removed)
            return { ...s, layers: layers.map((l, i) => ({ ...l, zIndex: i })) }
          }),
          updatedAt: Date.now(),
        },
      }
    }),

  duplicateScreenLayer: (screenId, layerId) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          screens: state.project.screens.map((s) => {
            if (s.id !== screenId) return s
            const layer = s.layers.find((l) => l.id === layerId)
            if (!layer) return s
            const dup: Layer = {
              ...layer,
              id: crypto.randomUUID(),
              name: `${layer.name} copy`,
              x: layer.x + 16,
              y: layer.y + 16,
            }
            return { ...s, layers: [...s.layers, dup] }
          }),
          updatedAt: Date.now(),
        },
      }
    }),
}))
