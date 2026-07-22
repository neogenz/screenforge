import { create } from 'zustand'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import type { Layer } from '@/types'

interface CanvasState {
  /** Mirror of the active screen's layers for panels and keyboard commands. */
  layers: Layer[]
  selectedLayerIds: string[]
  activeScreenId: string

  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<Layer>) => void
  selectLayer: (id: string) => void
  selectLayers: (ids: string[]) => void
  clearSelection: () => void
  reorderLayer: (id: string, newIndex: number) => void
  duplicateLayer: (id: string) => void
  setLayers: (layers: Layer[]) => void
  setActiveScreenId: (id: string) => void
  syncLayersFromProject: () => void
  undo: () => void
  redo: () => void
}

function syncFromProject(screenId: string): Layer[] {
  return useProjectStore
    .getState()
    .project?.screens.find((screen) => screen.id === screenId)?.layers ?? []
}

function serializeLayers(layers: Layer[]): string {
  return JSON.stringify(layers)
}

function restoreLayers(snapshot: string): Layer[] | null {
  try {
    const parsed: unknown = JSON.parse(snapshot)
    return Array.isArray(parsed) ? parsed as Layer[] : null
  } catch (error) {
    console.error('Could not restore layer history.', error)
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
    useHistoryStore.getState().record(serializeLayers(get().layers))
  }

  function persistLayers(layers: Layer[]) {
    const screenId = get().activeScreenId
    if (!screenId) return
    useProjectStore.getState().saveScreenLayers(screenId, layers)
    set({ layers: syncFromProject(screenId) })
  }

  function travel(direction: 'undo' | 'redo') {
    const { layers } = get()
    const history = useHistoryStore.getState()
    const snapshot = history[direction](serializeLayers(layers))
    if (!snapshot) return
    const restored = restoreLayers(snapshot)
    if (restored) persistLayers(restored)
  }

  return {
    layers: [],
    selectedLayerIds: [],
    activeScreenId: '',

    addLayer: (layer) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      recordCurrent()
      useProjectStore.getState().addScreenLayer(screenId, applyGlobalsToNewLayer(layer))
      set({ layers: syncFromProject(screenId) })
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
      if (!screenId || !get().layers.some((layer) => layer.id === id)) return
      recordCurrent()
      useProjectStore.getState().updateScreenLayer(screenId, id, updates)
      set({ layers: syncFromProject(screenId) })
    },

    selectLayer: (id) => set({ selectedLayerIds: [id] }),
    selectLayers: (ids) => set({ selectedLayerIds: ids }),
    clearSelection: () => set({ selectedLayerIds: [] }),

    reorderLayer: (id, newIndex) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      recordCurrent()
      useProjectStore.getState().reorderScreenLayer(screenId, id, newIndex)
      set({ layers: syncFromProject(screenId) })
    },

    duplicateLayer: (id) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      recordCurrent()
      useProjectStore.getState().duplicateScreenLayer(screenId, id)
      set({ layers: syncFromProject(screenId) })
    },

    setLayers: (layers) => {
      recordCurrent()
      persistLayers(layers)
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

    undo: () => travel('undo'),
    redo: () => travel('redo'),
  }
})
