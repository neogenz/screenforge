import { create } from 'zustand'
import { useHistoryStore } from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import type { Background, Layer, Project, Screen, TemplateDefinition } from '@/types'

interface ScreenHistorySnapshot {
  kind: 'screen'
  screenId: string
  layers: Layer[]
  background: Background
}

interface ProjectHistorySnapshot {
  kind: 'project'
  project: Project
}

type HistorySnapshot = ScreenHistorySnapshot | ProjectHistorySnapshot

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
  recordProjectHistory: () => void
  applyTemplate: (template: TemplateDefinition, mode: 'current' | 'new') => string | null
  undo: () => void
  redo: () => void
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function withoutThumbnail(screen: Screen): Screen {
  const snapshot = { ...screen }
  delete snapshot.thumbnail
  return snapshot
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
    ? JSON.stringify({
        kind: 'screen',
        screenId,
        layers: screen.layers,
        background: screen.background,
      } satisfies ScreenHistorySnapshot)
    : null
}

function serializeProject(): string | null {
  const project = useProjectStore.getState().project
  return project
    ? JSON.stringify({
        kind: 'project',
        project: {
          ...project,
          screens: project.screens.map(withoutThumbnail),
        },
      } satisfies ProjectHistorySnapshot)
    : null
}

function parseSnapshot(snapshot: string): HistorySnapshot | null {
  try {
    const parsed: unknown = JSON.parse(snapshot)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<HistorySnapshot> & {
      layers?: Layer[]
      background?: Background
    }
    if (candidate.kind === 'project' && candidate.project?.screens?.length) {
      return candidate as ProjectHistorySnapshot
    }
    if (candidate.kind === 'screen'
      && typeof candidate.screenId === 'string'
      && Array.isArray(candidate.layers)
      && candidate.background) {
      return candidate as ScreenHistorySnapshot
    }
    // Compatibility with history entries created before project-wide snapshots.
    if (Array.isArray(candidate.layers) && candidate.background) {
      const screenId = useCanvasStore.getState().activeScreenId
      return { kind: 'screen', screenId, layers: candidate.layers, background: candidate.background }
    }
    return null
  } catch (error) {
    console.error('Could not restore editor history.', error)
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

  function recordProject() {
    const snapshot = serializeProject()
    if (snapshot) useHistoryStore.getState().record(snapshot)
  }

  function persistScreen(snapshot: ScreenHistorySnapshot) {
    const project = useProjectStore.getState().project
    if (!project || !project.screens.some((screen) => screen.id === snapshot.screenId)) return
    useProjectStore.setState({
      project: {
        ...project,
        activeScreenId: snapshot.screenId,
        screens: project.screens.map((screen) => screen.id === snapshot.screenId
          ? {
              ...screen,
              layers: cloneValue(snapshot.layers),
              background: cloneValue(snapshot.background),
              thumbnail: undefined,
            }
          : screen),
        updatedAt: Math.max(Date.now(), project.updatedAt + 1),
      },
    })
    set({
      activeScreenId: snapshot.screenId,
      layers: syncFromProject(snapshot.screenId),
      selectedLayerIds: [],
    })
  }

  function persistProject(snapshot: ProjectHistorySnapshot) {
    const current = useProjectStore.getState().project
    const restored = cloneValue(snapshot.project)
    const activeScreenId = restored.screens.some((screen) => screen.id === restored.activeScreenId)
      ? restored.activeScreenId
      : restored.screens[0]?.id ?? ''
    useProjectStore.setState({
      project: {
        ...restored,
        activeScreenId,
        updatedAt: Math.max(Date.now(), (current?.updatedAt ?? 0) + 1),
      },
    })
    set({
      activeScreenId,
      layers: syncFromProject(activeScreenId),
      selectedLayerIds: [],
    })
  }

  function travel(direction: 'undo' | 'redo') {
    const history = useHistoryStore.getState()
    const stack = direction === 'undo' ? history.past : history.future
    const targetHint = stack[stack.length - 1] ? parseSnapshot(stack[stack.length - 1]) : null
    if (!targetHint) return
    const current = targetHint.kind === 'project'
      ? serializeProject()
      : serializeScreen(targetHint.screenId)
    if (!current) return
    const target = history[direction](current)
    if (!target) return
    const restored = parseSnapshot(target)
    if (!restored) return
    if (restored.kind === 'project') persistProject(restored)
    else persistScreen(restored)
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
      persistScreen({
        kind: 'screen',
        screenId: screen.id,
        layers: screen.layers,
        background,
      })
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
      persistScreen({
        kind: 'screen',
        screenId: screen.id,
        layers,
        background: screen.background,
      })
    },

    setActiveScreenId: (id) => {
      const project = useProjectStore.getState().project
      const validId = project?.screens.some((screen) => screen.id === id)
        ? id
        : project?.screens.some((screen) => screen.id === project.activeScreenId)
          ? project.activeScreenId
          : project?.screens[0]?.id ?? ''
      if (project && validId && project.activeScreenId !== validId) {
        useProjectStore.setState({
          project: {
            ...project,
            activeScreenId: validId,
            updatedAt: Math.max(Date.now(), project.updatedAt + 1),
          },
        })
      }
      set({
        activeScreenId: validId,
        layers: syncFromProject(validId),
        selectedLayerIds: [],
      })
    },

    syncLayersFromProject: () => {
      const project = useProjectStore.getState().project
      const currentId = get().activeScreenId
      const screenId = project?.screens.some((screen) => screen.id === currentId)
        ? currentId
        : project?.activeScreenId ?? project?.screens[0]?.id ?? ''
      set({ activeScreenId: screenId, layers: syncFromProject(screenId) })
    },

    recordHistory: recordCurrent,
    recordProjectHistory: recordProject,

    applyTemplate: (template, mode) => {
      const project = useProjectStore.getState().project
      if (!project) return null
      const layers = template.layers.map((layer, index) => ({
        ...cloneValue(layer),
        id: crypto.randomUUID(),
        zIndex: index,
      })) as Layer[]

      if (mode === 'current') {
        const screenId = get().activeScreenId || project.activeScreenId || project.screens[0]?.id
        if (!screenId) return null
        recordCurrent()
        useProjectStore.getState().replaceScreenContent(screenId, template.background, layers)
        set({ activeScreenId: screenId, layers: syncFromProject(screenId), selectedLayerIds: [] })
        return screenId
      }

      if (project.screens.length >= MAX_PROJECT_SCREENS) return null
      recordProject()
      const screenId = useProjectStore.getState().addScreen({
        name: `${template.name} ${project.screens.length + 1}`,
        background: template.background,
        layers,
      })
      if (!screenId) return null
      set({ activeScreenId: screenId, layers: syncFromProject(screenId), selectedLayerIds: [] })
      return screenId
    },

    undo: () => travel('undo'),
    redo: () => travel('redo'),
  }
})
