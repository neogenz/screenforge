import { create } from 'zustand'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import type { Background, Layer, Screen } from '@/types'

interface ScreenHistorySnapshot {
  layers: Layer[]
  background: Background
}

interface CanvasState {
  /** Mirror of the active screen's layers for panels and keyboard commands. */
  layers: Layer[]
  selectedLayerIds: string[]
  activeScreenId: string

  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<Layer>) => void
  updateBackground: (background: Background) => void
  selectLayer: (id: string) => void
  selectLayers: (ids: string[]) => void
  clearSelection: () => void
  reorderLayer: (id: string, newIndex: number) => void
  duplicateLayer: (id: string) => void
  setLayers: (layers: Layer[]) => void
  setActiveScreenId: (id: string) => void
  syncLayersFromProject: () => void
  recordHistory: () => void
  undo: () => void
  redo: () => void
}

function activeScreen(screenId: string): Screen | undefined {
  return useProjectStore
    .getState()
    .project?.screens.find((screen) => screen.id === screenId)
}

function syncFromProject(screenId: string): Layer[] {
  return activeScreen(screenId)?.layers ?? []
}

function serializeScreen(screenId: string): string | null {
  const screen = activeScreen(screenId)
  return screen
    ? JSON.stringify({ layers: screen.layers, background: screen.background })
    : null
}

function restoreScreen(snapshot: string): ScreenHistorySnapshot | null {
  try {
    const parsed: unknown = JSON.parse(snapshot)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<ScreenHistorySnapshot>
    return Array.isArray(candidate.layers) && candidate.background
      ? candidate as ScreenHistorySnapshot
      : null
  } catch (error) {
    console.error('Could not restore screen history.', error)
    return null
  }
}

function applyGlobalsToNewLayer(layer: Layer): Layer {
  const globals = useProjectStore.getState().project?.globals
  if (!globals) return layer

  if (layer.type === 'text') {
    return {
      ...layer,
      fontFamily: globals.fontFamily,
      fontWeight: globals.fontWeight,
      fontSize: globals.fontSize,
      color: globals.fontColor,
    }
  }

  if (layer.type === 'device-frame') {
    return {
      ...layer,
      deviceModel: globals.deviceModel,
      deviceColor: globals.deviceColor,
    }
  }

  return layer
}

export const useCanvasStore = create<CanvasState>()((set, get) => {
  function recordCurrent() {
    const snapshot = serializeScreen(get().activeScreenId)
    if (snapshot) useHistoryStore.getState().record(snapshot)
  }

  function persistScreen(snapshot: ScreenHistorySnapshot) {
    const screenId = get().activeScreenId
    const project = useProjectStore.getState().project
    if (!screenId || !project) return
    useProjectStore.setState({
      project: {
        ...project,
        screens: project.screens.map((screen) => screen.id === screenId
          ? { ...screen, layers: snapshot.layers, background: snapshot.background }
          : screen),
        updatedAt: Math.max(Date.now(), project.updatedAt + 1),
      },
    })
    set({ layers: syncFromProject(screenId) })
  }

  function travel(direction: 'undo' | 'redo') {
    const snapshot = serializeScreen(get().activeScreenId)
    if (!snapshot) return
    const history = useHistoryStore.getState()
    const target = history[direction](snapshot)
    if (!target) return
    const restored = restoreScreen(target)
    if (restored) persistScreen(restored)
  }

  return {
    layers: [],
    selectedLayerIds: [],
    activeScreenId: '',

    addLayer: (layer) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      recordCurrent()
      const nextLayer = applyGlobalsToNewLayer(layer)
      useProjectStore.getState().addScreenLayer(screenId, nextLayer)
      set({ layers: syncFromProject(screenId), selectedLayerIds: [nextLayer.id] })
    },

    removeLayer: (id) => {
      const screenId = get().activeScreenId
      if (!screenId || !get().layers.some((layer) => layer.id === id)) return
      recordCurrent()
      useProjectStore.getState().removeScreenLayer(screenId, id)
      set((state) => ({
        layers: syncFromProject(screenId),
        selectedLayerIds: state.selectedLayerIds.filter((selectedId) => selectedId !== id),
      }))
    },

    updateLayer: (id, updates) => {
      const screenId = get().activeScreenId
      const layer = get().layers.find((candidate) => candidate.id === id)
      if (!screenId || !layer) return
      const changed = Object.entries(updates).some(
        ([key, value]) => !Object.is(layer[key as keyof Layer], value),
      )
      if (!changed) return
      recordCurrent()
      useProjectStore.getState().updateScreenLayer(screenId, id, updates)
      set({ layers: syncFromProject(screenId) })
    },

    updateBackground: (background) => {
      const screen = activeScreen(get().activeScreenId)
      if (!screen || JSON.stringify(screen.background) === JSON.stringify(background)) return
      recordCurrent()
      persistScreen({ layers: screen.layers, background })
    },

    selectLayer: (id) => set({ selectedLayerIds: [id] }),
    selectLayers: (ids) => set({ selectedLayerIds: ids }),
    clearSelection: () => set({ selectedLayerIds: [] }),

    reorderLayer: (id, newIndex) => {
      const screenId = get().activeScreenId
      const currentIndex = get().layers.findIndex((layer) => layer.id === id)
      if (!screenId || currentIndex === -1 || currentIndex === newIndex) return
      recordCurrent()
      useProjectStore.getState().reorderScreenLayer(screenId, id, newIndex)
      set({ layers: syncFromProject(screenId), selectedLayerIds: [id] })
    },

    duplicateLayer: (id) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      const previousIds = new Set(get().layers.map((layer) => layer.id))
      recordCurrent()
      useProjectStore.getState().duplicateScreenLayer(screenId, id)
      const layers = syncFromProject(screenId)
      const duplicate = layers.find((layer) => !previousIds.has(layer.id))
      set({
        layers,
        selectedLayerIds: duplicate ? [duplicate.id] : get().selectedLayerIds,
      })
    },

    setLayers: (layers) => {
      const screen = activeScreen(get().activeScreenId)
      if (!screen) return
      recordCurrent()
      persistScreen({ layers, background: screen.background })
    },

    setActiveScreenId: (id) => {
      const project = useProjectStore.getState().project
      const validId = project?.screens.some((screen) => screen.id === id)
        ? id
        : project?.screens[0]?.id ?? ''
      useHistoryStore.getState().clear()
      set({
        activeScreenId: validId,
        layers: syncFromProject(validId),
        selectedLayerIds: [],
      })
    },

    syncLayersFromProject: () => {
      const screenId = get().activeScreenId
      set({ layers: syncFromProject(screenId) })
    },

    recordHistory: recordCurrent,
    undo: () => travel('undo'),
    redo: () => travel('redo'),
  }
})
