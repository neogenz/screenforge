import { create } from 'zustand'
import {
  useHistoryStore,
  type HistorySnapshot,
  type ProjectHistorySnapshot,
  type ScreenHistorySnapshot,
} from '@/stores/history.store'
import { useProjectStore } from '@/stores/project.store'
import { MAX_PROJECT_SCREENS } from '@/lib/dimensions'
import { nextTimestamp } from '@/lib/time'
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '@/components/canvas/canvas-utils'
import { alignTo, boundsOf, distribute } from '@/lib/align'
import type { AlignMode, DistributeMode, Placeable } from '@/lib/align'
import type { Background, Layer, Screen, TemplateDefinition } from '@/types'

interface EditOptions {
  /** Burst key: rapid edits with the same key collapse into one undo step. */
  coalesceKey?: string
}

interface CanvasState {
  /** Mirror of the active screen's layers for panels and keyboard commands. */
  layers: Layer[]
  selectedLayerIds: string[]
  activeScreenId: string

  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<Layer>, options?: EditOptions) => void
  updateBackground: (background: Background, options?: EditOptions) => void
  selectLayer: (id: string) => void
  selectLayers: (ids: string[]) => void
  clearSelection: () => void
  reorderLayer: (id: string, newIndex: number) => void
  duplicateLayer: (id: string) => void
  setLayerScope: (id: string, scope: 'screen' | 'layout') => void
  setLayers: (layers: Layer[], options?: EditOptions) => void
  alignSelection: (mode: AlignMode) => void
  distributeSelection: (mode: DistributeMode) => void
  setActiveScreenId: (id: string) => void
  syncLayersFromProject: () => void
  recordHistory: () => void
  recordProjectHistory: () => void
  applyTemplate: (template: TemplateDefinition, mode: 'current' | 'new') => string | null
  undo: () => void
  redo: () => void
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
  const project = useProjectStore.getState().project
  return [
    ...(project?.screens.find((screen) => screen.id === screenId)?.layers ?? []),
    ...(project?.layoutLayers ?? []),
  ]
}

/**
 * Identity-preserving mirror update: keeps the previous array (and lets
 * useShallow selectors skip the render) when every layer ref is unchanged.
 */
function syncLayersPreservingIdentity(previous: Layer[], screenId: string): Layer[] {
  const next = syncFromProject(screenId)
  if (
    previous.length === next.length
    && previous.every((layer, index) => layer === next[index])
  ) {
    return previous
  }
  return next
}

function screenSnapshot(screenId: string): ScreenHistorySnapshot | null {
  const screen = activeScreen(screenId)
  return screen
    ? {
        kind: 'screen',
        screenId,
        layers: screen.layers,
        background: screen.background,
      }
    : null
}

function projectSnapshot(): ProjectHistorySnapshot | null {
  const project = useProjectStore.getState().project
  return project
    ? {
        kind: 'project',
        project: {
          ...project,
          screens: project.screens.map(withoutThumbnail),
        },
      }
    : null
}

function selectedLayers(state: Pick<CanvasState, 'layers' | 'selectedLayerIds'>): Layer[] {
  const selected = new Set(state.selectedLayerIds)
  return state.layers.filter((layer) => selected.has(layer.id) && !layer.locked)
}

/**
 * Sur quoi la sélection s'aligne. Au-delà d'un calque c'est la boîte de la
 * sélection : aligner un groupe sur l'artboard l'empilerait sur un seul bord.
 * Un calque isolé, lui, n'a que l'artboard comme référence utile.
 *
 * Un calque partagé vit dans l'espace continu de la planche, qui saute les
 * gouttières : sa fenêtre est celle de l'écran actif, décalée d'autant.
 */
function alignmentReference(
  state: Pick<CanvasState, 'activeScreenId'>,
  selected: Layer[],
): Placeable {
  if (selected.length > 1) return boundsOf(selected)
  const screens = useProjectStore.getState().project?.screens ?? []
  const index = selected[0]?.scope === 'layout'
    ? Math.max(0, screens.findIndex((screen) => screen.id === state.activeScreenId))
    : 0
  return { x: index * SCREEN_WIDTH, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT }
}

/** Réécrit les positions calculées dans la liste complète, ordre préservé. */
function placeLayers(
  layers: Layer[],
  selected: Layer[],
  placements: { x: number; y: number }[],
): Layer[] {
  const moves = new Map(selected.map((layer, index) => [layer.id, placements[index]]))
  return layers.map((layer) => {
    const move = moves.get(layer.id)
    return move ? { ...layer, x: Math.round(move.x), y: Math.round(move.y) } : layer
  })
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

  return layer
}

export const useCanvasStore = create<CanvasState>()((set, get) => {
  function recordCurrent(coalesceKey?: string) {
    const snapshot = screenSnapshot(get().activeScreenId)
    if (snapshot) useHistoryStore.getState().record(snapshot, coalesceKey)
  }

  function recordProject(coalesceKey?: string) {
    const snapshot = projectSnapshot()
    if (snapshot) useHistoryStore.getState().record(snapshot, coalesceKey)
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
              layers: structuredClone(snapshot.layers),
              background: structuredClone(snapshot.background),
              thumbnail: undefined,
            }
          : screen),
        updatedAt: nextTimestamp(project.updatedAt),
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
    const restored = structuredClone(snapshot.project)
    const activeScreenId = restored.screens.some((screen) => screen.id === restored.activeScreenId)
      ? restored.activeScreenId
      : restored.screens[0]?.id ?? ''
    useProjectStore.setState({
      project: {
        ...restored,
        activeScreenId,
        updatedAt: nextTimestamp(current?.updatedAt ?? 0),
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
    const targetHint: HistorySnapshot | undefined = stack[stack.length - 1]
    if (!targetHint) return
    const current = targetHint.kind === 'project'
      ? projectSnapshot()
      : screenSnapshot(targetHint.screenId)
    if (!current) return
    const restored = history[direction](current)
    if (restored?.kind === 'project') persistProject(restored)
    else if (restored) persistScreen(restored)
  }

  return {
    layers: [],
    selectedLayerIds: [],
    activeScreenId: '',

    addLayer: (layer) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      const nextLayer = applyGlobalsToNewLayer(layer)
      if (nextLayer.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore.getState().saveLayoutLayers([
          ...project.layoutLayers,
          { ...nextLayer, scope: 'layout' },
        ])
      } else {
        recordCurrent()
        useProjectStore.getState().addScreenLayer(screenId, nextLayer)
      }
      set({ layers: syncFromProject(screenId), selectedLayerIds: [nextLayer.id] })
    },

    removeLayer: (id) => {
      const screenId = get().activeScreenId
      const layer = get().layers.find((candidate) => candidate.id === id)
      if (!screenId || !layer) return
      if (layer.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore.getState().saveLayoutLayers(
          project.layoutLayers.filter((candidate) => candidate.id !== id),
        )
      } else {
        recordCurrent()
        useProjectStore.getState().removeScreenLayer(screenId, id)
      }
      set((state) => ({
        layers: syncFromProject(screenId),
        selectedLayerIds: state.selectedLayerIds.filter((selectedId) => selectedId !== id),
      }))
    },

    updateLayer: (id, updates, options) => {
      const screenId = get().activeScreenId
      const layer = get().layers.find((candidate) => candidate.id === id)
      if (!screenId || !layer) return
      const changed = Object.entries(updates).some(
        ([key, value]) => !Object.is(layer[key as keyof Layer], value),
      )
      if (!changed) return
      if (layer.scope === 'layout') {
        recordProject(options?.coalesceKey)
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore.getState().saveLayoutLayers(project.layoutLayers.map((candidate) =>
          candidate.id === id ? { ...candidate, ...updates, scope: 'layout' } as Layer : candidate,
        ))
      } else {
        recordCurrent(options?.coalesceKey)
        useProjectStore.getState().updateScreenLayer(screenId, id, updates)
      }
      set((state) => ({ layers: syncLayersPreservingIdentity(state.layers, screenId) }))
    },

    updateBackground: (background, options) => {
      const screen = activeScreen(get().activeScreenId)
      if (!screen || JSON.stringify(screen.background) === JSON.stringify(background)) return
      recordCurrent(options?.coalesceKey)
      persistScreen({
        kind: 'screen',
        screenId: screen.id,
        layers: screen.layers,
        background,
      })
    },

    // Sélectionner n'ouvre plus le drawer Propriétés. Il mangeait un tiers du
    // stage au premier clic, et la barre contextuelle — qui ne s'affiche que
    // drawer fermé — n'était alors jamais atteignable. Le drawer reste sous la
    // main de l'utilisateur : bouton de la barre du haut, ou son raccourci.
    selectLayer: (id) => set({ selectedLayerIds: [id] }),
    selectLayers: (ids) => set({ selectedLayerIds: ids }),
    clearSelection: () => set({ selectedLayerIds: [] }),

    reorderLayer: (id, newIndex) => {
      const screenId = get().activeScreenId
      const layer = get().layers.find((candidate) => candidate.id === id)
      const scopedLayers = get().layers.filter((candidate) => candidate.scope === layer?.scope)
      const currentIndex = scopedLayers.findIndex((candidate) => candidate.id === id)
      if (!screenId || currentIndex === -1 || currentIndex === newIndex) return
      if (layer?.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        const layoutLayers = [...project.layoutLayers]
        const [moved] = layoutLayers.splice(currentIndex, 1)
        layoutLayers.splice(Math.max(0, Math.min(newIndex, layoutLayers.length)), 0, moved)
        useProjectStore.getState().saveLayoutLayers(
          layoutLayers.map((candidate, index) => ({ ...candidate, zIndex: index, scope: 'layout' })),
        )
      } else {
        recordCurrent()
        useProjectStore.getState().reorderScreenLayer(screenId, id, newIndex)
      }
      set({ layers: syncFromProject(screenId), selectedLayerIds: [id] })
    },

    duplicateLayer: (id) => {
      const screenId = get().activeScreenId
      if (!screenId) return
      const source = get().layers.find((layer) => layer.id === id)
      if (!source) return
      const previousIds = new Set(get().layers.map((layer) => layer.id))
      if (source.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore.getState().saveLayoutLayers([
          ...project.layoutLayers,
          {
            ...structuredClone(source),
            id: crypto.randomUUID(),
            name: `${source.name} copie`,
            x: source.x + 16,
            y: source.y + 16,
            zIndex: project.layoutLayers.length,
            scope: 'layout',
          },
        ])
      } else {
        recordCurrent()
        useProjectStore.getState().duplicateScreenLayer(screenId, id)
      }
      const layers = syncFromProject(screenId)
      const duplicate = layers.find((layer) => !previousIds.has(layer.id))
      set({
        layers,
        selectedLayerIds: duplicate ? [duplicate.id] : get().selectedLayerIds,
      })
    },

    setLayerScope: (id, scope) => {
      const project = useProjectStore.getState().project
      const screenId = get().activeScreenId
      const screenIndex = project?.screens.findIndex((screen) => screen.id === screenId) ?? -1
      if (!project || screenIndex === -1) return
      const screen = project.screens[screenIndex]
      const screenLayer = screen.layers.find((layer) => layer.id === id)
      const layoutLayer = project.layoutLayers.find((layer) => layer.id === id)
      if ((scope === 'layout' && !screenLayer) || (scope === 'screen' && !layoutLayer)) return

      recordProject()
      const moved = structuredClone((screenLayer ?? layoutLayer) as Layer)
      const screens = project.screens.map((candidate) => candidate.id === screenId
        ? {
            ...candidate,
            layers: scope === 'layout'
              ? candidate.layers.filter((layer) => layer.id !== id)
              : [
                  ...candidate.layers,
                  {
                    ...moved,
                    x: moved.x - screenIndex * SCREEN_WIDTH,
                    zIndex: moved.zIndex,
                    scope: undefined,
                  },
                ],
          }
        : candidate)
      const layoutLayers = scope === 'layout'
        ? [
            ...project.layoutLayers,
            {
              ...moved,
              x: moved.x + screenIndex * SCREEN_WIDTH,
              zIndex: moved.zIndex,
              scope: 'layout' as const,
            },
          ]
        : project.layoutLayers.filter((layer) => layer.id !== id)
      useProjectStore.setState({
        project: {
          ...project,
          screens,
          layoutLayers,
          updatedAt: nextTimestamp(project.updatedAt),
        },
      })
      set({ layers: syncFromProject(screenId), selectedLayerIds: [id] })
    },

    setLayers: (layers, options) => {
      const screen = activeScreen(get().activeScreenId)
      if (!screen) return
      recordProject(options?.coalesceKey)
      const project = useProjectStore.getState().project
      if (!project) return
      useProjectStore.setState({
        project: {
          ...project,
          screens: project.screens.map((candidate) => candidate.id === screen.id
            ? { ...candidate, layers: layers.filter((layer) => layer.scope !== 'layout') }
            : candidate),
          layoutLayers: layers.filter((layer) => layer.scope === 'layout'),
          updatedAt: nextTimestamp(project.updatedAt),
        },
      })
      set((state) => ({ layers: syncLayersPreservingIdentity(state.layers, screen.id) }))
    },

    alignSelection: (mode) => {
      const selected = selectedLayers(get())
      if (selected.length === 0) return
      const placements = alignTo(selected, mode, alignmentReference(get(), selected))
      get().setLayers(placeLayers(get().layers, selected, placements))
    },

    distributeSelection: (mode) => {
      const selected = selectedLayers(get())
      // Deux calques sont déjà « répartis » : il n'y a pas d'intervalle intérieur.
      if (selected.length < 3) return
      get().setLayers(placeLayers(get().layers, selected, distribute(selected, mode)))
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
            updatedAt: nextTimestamp(project.updatedAt),
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
      set((state) => ({
        activeScreenId: screenId,
        layers: syncLayersPreservingIdentity(state.layers, screenId),
      }))
    },

    recordHistory: recordCurrent,
    recordProjectHistory: recordProject,

    applyTemplate: (template, mode) => {
      const project = useProjectStore.getState().project
      if (!project) return null
      const layers = template.layers.map((layer, index) => ({
        ...structuredClone(layer),
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
