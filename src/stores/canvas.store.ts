import { create } from 'zustand'
import { useProjectStore } from '@/stores/project.store'
import type { Layer } from '@/types'

interface CanvasState {
  /** Mirror of the active screen's layers (for panels). */
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
  /** Re-sync layers from project store for the active screen. */
  syncLayersFromProject: () => void
}

function syncFromProject(screenId: string): Layer[] {
  const screen = useProjectStore
    .getState()
    .project?.screens.find((s) => s.id === screenId)
  return screen?.layers ?? []
}

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  layers: [],
  selectedLayerIds: [],
  activeScreenId: '',

  addLayer: (layer) => {
    const sid = get().activeScreenId
    if (!sid) return
    useProjectStore.getState().addScreenLayer(sid, layer)
    set({ layers: syncFromProject(sid) })
  },

  removeLayer: (id) => {
    const sid = get().activeScreenId
    if (!sid) return
    useProjectStore.getState().removeScreenLayer(sid, id)
    set({
      layers: syncFromProject(sid),
      selectedLayerIds: get().selectedLayerIds.filter((s) => s !== id),
    })
  },

  updateLayer: (id, updates) => {
    const sid = get().activeScreenId
    if (!sid) return
    useProjectStore.getState().updateScreenLayer(sid, id, updates)
    set({ layers: syncFromProject(sid) })
  },

  selectLayer: (id) => set({ selectedLayerIds: [id] }),
  selectLayers: (ids) => set({ selectedLayerIds: ids }),
  clearSelection: () => set({ selectedLayerIds: [] }),

  reorderLayer: (id, newIndex) => {
    const sid = get().activeScreenId
    if (!sid) return
    useProjectStore.getState().reorderScreenLayer(sid, id, newIndex)
    set({ layers: syncFromProject(sid) })
  },

  duplicateLayer: (id) => {
    const sid = get().activeScreenId
    if (!sid) return
    useProjectStore.getState().duplicateScreenLayer(sid, id)
    set({ layers: syncFromProject(sid) })
  },

  setLayers: (layers) => {
    const sid = get().activeScreenId
    if (sid) {
      useProjectStore.getState().saveScreenLayers(sid, layers)
    }
    set({ layers })
  },

  setActiveScreenId: (id) => {
    set({
      activeScreenId: id,
      layers: syncFromProject(id),
      selectedLayerIds: [],
    })
  },

  syncLayersFromProject: () => {
    const sid = get().activeScreenId
    set({ layers: syncFromProject(sid) })
  },
}))
