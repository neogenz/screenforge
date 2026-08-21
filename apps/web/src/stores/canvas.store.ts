import { create } from 'zustand'
import {
  useHistoryStore,
  type HistorySnapshot,
  type ProjectHistorySnapshot,
  type ScreenHistorySnapshot,
} from '@/stores/history.store'
import { getActiveScreen, getProjectLayers, useProjectStore } from '@/stores/project.store'
import { getStoreTargetProfile } from '@/lib/dimensions'
import { nextTimestamp } from '@/lib/time'
import { alignTo, boundsOf, distribute } from '@/lib/align'
import type { AlignMode, DistributeMode, Placeable } from '@/lib/align'
import type { TextRange } from '@/lib/text-styles'
import type { Background, Layer, Screen, TemplateDefinition } from '@/types'

interface EditOptions {
  /** Burst key: rapid edits with the same key collapse into one undo step. */
  coalesceKey?: string
}

interface CanvasState {
  selectedLayerIds: string[]
  /**
   * Le passage sélectionné dans un texte en cours d'édition sur le canevas.
   *
   * État de canevas, pas de projet : il ne s'enregistre pas, ne s'annule pas et
   * meurt avec l'édition. Il vit ici parce que c'est la seule sélection que le
   * panneau ne peut pas déduire du projet — Fabric seul sait où est le curseur.
   */
  textRange: TextRange | null

  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  updateLayer: (id: string, updates: Partial<Layer>, options?: EditOptions) => void
  updateSelectedLayers: (updates: Partial<Layer>, options?: EditOptions) => void
  setTextRange: (range: TextRange | null) => void
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
  recordHistory: () => void
  recordProjectHistory: () => void
  applyTemplate: (template: TemplateDefinition, mode: 'current' | 'new') => string | null
  undo: () => void
  redo: () => void
}

export function withoutThumbnail(screen: Screen): Screen {
  const snapshot = { ...screen }
  delete snapshot.thumbnail
  return snapshot
}

function activeScreen(): Screen | undefined {
  return getActiveScreen(useProjectStore.getState().project)
}

function screenSnapshot(screenId = activeScreen()?.id): ScreenHistorySnapshot | null {
  const screen = useProjectStore
    .getState()
    .project?.screens.find((candidate) => candidate.id === screenId)
  return screen
    ? {
        kind: 'screen',
        screenId: screen.id,
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

function selectedLayers(state: Pick<CanvasState, 'selectedLayerIds'>): Layer[] {
  const selected = new Set(state.selectedLayerIds)
  return getProjectLayers(useProjectStore.getState().project).filter(
    (layer) => selected.has(layer.id) && !layer.locked,
  )
}

/**
 * Sur quoi la sélection s'aligne. Au-delà d'un calque c'est la boîte de la
 * sélection : aligner un groupe sur l'artboard l'empilerait sur un seul bord.
 * Un calque isolé, lui, n'a que l'artboard comme référence utile.
 *
 * Un calque partagé vit dans l'espace continu de la planche, qui saute les
 * gouttières : sa fenêtre est celle de l'écran actif, décalée d'autant.
 */
function alignmentReference(selected: Layer[]): Placeable {
  if (selected.length > 1) return boundsOf(selected)
  const project = useProjectStore.getState().project
  const screens = project?.screens ?? []
  const board = project ? getStoreTargetProfile(project.target).board : { width: 440, height: 956 }
  const index =
    selected[0]?.scope === 'layout'
      ? Math.max(
          0,
          screens.findIndex((screen) => screen.id === project?.activeScreenId),
        )
      : 0
  return { x: index * board.width, y: 0, width: board.width, height: board.height }
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
    const snapshot = screenSnapshot()
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
        screens: project.screens.map((screen) =>
          screen.id === snapshot.screenId
            ? {
                ...screen,
                layers: structuredClone(snapshot.layers),
                background: structuredClone(snapshot.background),
                thumbnail: undefined,
              }
            : screen,
        ),
        updatedAt: nextTimestamp(project.updatedAt),
      },
    })
    set({ selectedLayerIds: [] })
  }

  function persistProject(snapshot: ProjectHistorySnapshot) {
    const current = useProjectStore.getState().project
    const restored = structuredClone(snapshot.project)
    const activeScreenId = restored.screens.some((screen) => screen.id === restored.activeScreenId)
      ? restored.activeScreenId
      : (restored.screens[0]?.id ?? '')
    useProjectStore.setState({
      project: {
        ...restored,
        activeScreenId,
        updatedAt: nextTimestamp(current?.updatedAt ?? 0),
      },
    })
    set({ selectedLayerIds: [] })
  }

  function travel(direction: 'undo' | 'redo') {
    const history = useHistoryStore.getState()
    const stack = direction === 'undo' ? history.past : history.future
    const targetHint: HistorySnapshot | undefined = stack[stack.length - 1]
    if (!targetHint) return
    const current =
      targetHint.kind === 'project' ? projectSnapshot() : screenSnapshot(targetHint.screenId)
    if (!current) return
    const restored = history[direction](current)
    if (restored?.kind === 'project') persistProject(restored)
    else if (restored) persistScreen(restored)
  }

  return {
    selectedLayerIds: [],
    textRange: null,

    addLayer: (layer) => {
      const screenId = activeScreen()?.id
      if (!screenId) return
      const nextLayer = applyGlobalsToNewLayer(layer)
      if (nextLayer.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore
          .getState()
          .saveLayoutLayers([...project.layoutLayers, { ...nextLayer, scope: 'layout' }])
      } else {
        recordCurrent()
        useProjectStore.getState().addScreenLayer(screenId, nextLayer)
      }
      set({ selectedLayerIds: [nextLayer.id] })
    },

    removeLayer: (id) => {
      const screenId = activeScreen()?.id
      const layer = getProjectLayers(useProjectStore.getState().project).find(
        (candidate) => candidate.id === id,
      )
      if (!screenId || !layer) return
      if (layer.scope === 'layout') {
        recordProject()
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore
          .getState()
          .saveLayoutLayers(project.layoutLayers.filter((candidate) => candidate.id !== id))
      } else {
        recordCurrent()
        useProjectStore.getState().removeScreenLayer(screenId, id)
      }
      set((state) => ({
        selectedLayerIds: state.selectedLayerIds.filter((selectedId) => selectedId !== id),
      }))
    },

    updateLayer: (id, updates, options) => {
      const screenId = activeScreen()?.id
      const layer = getProjectLayers(useProjectStore.getState().project).find(
        (candidate) => candidate.id === id,
      )
      if (!screenId || !layer) return
      const changed = Object.entries(updates).some(
        ([key, value]) => !Object.is(layer[key as keyof Layer], value),
      )
      if (!changed) return
      if (layer.scope === 'layout') {
        recordProject(options?.coalesceKey)
        const project = useProjectStore.getState().project
        if (!project) return
        useProjectStore
          .getState()
          .saveLayoutLayers(
            project.layoutLayers.map((candidate) =>
              candidate.id === id
                ? ({ ...candidate, ...updates, scope: 'layout' } as Layer)
                : candidate,
            ),
          )
      } else {
        recordCurrent(options?.coalesceKey)
        useProjectStore.getState().updateScreenLayer(screenId, id, updates)
      }
    },

    updateSelectedLayers: (updates, options) => {
      const project = useProjectStore.getState().project
      const ids = new Set(get().selectedLayerIds)
      if (!project || ids.size === 0) return
      const changed = (layer: Layer) =>
        ids.has(layer.id) &&
        Object.entries(updates).some(([key, value]) => !Object.is(layer[key as keyof Layer], value))
      const allLayers = [
        ...project.screens.flatMap((screen) => screen.layers),
        ...project.layoutLayers,
      ]
      if (!allLayers.some(changed)) return

      recordProject(options?.coalesceKey)
      const update = (layer: Layer): Layer =>
        ids.has(layer.id) ? ({ ...layer, ...updates } as Layer) : layer
      useProjectStore.setState({
        project: {
          ...project,
          screens: project.screens.map((screen) => ({
            ...screen,
            layers: screen.layers.map(update),
          })),
          layoutLayers: project.layoutLayers.map(update),
          updatedAt: nextTimestamp(project.updatedAt),
        },
      })
    },

    updateBackground: (background, options) => {
      const screen = activeScreen()
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
    clearSelection: () => set({ selectedLayerIds: [], textRange: null }),
    // Fabric annonce la sélection à chaque frappe et à chaque mouvement du
    // curseur. Sans cette garde, poser le même `null` mille fois de suite
    // rendrait un nouvel objet d'état à chaque touche, donc un rendu du panneau
    // Propriétés et de la barre de sélection au milieu de la saisie.
    setTextRange: (range) => {
      const current = get().textRange
      if (
        current === range ||
        (current?.layerId === range?.layerId &&
          current?.start === range?.start &&
          current?.end === range?.end)
      )
        return
      set({ textRange: range })
    },

    reorderLayer: (id, newIndex) => {
      const screenId = activeScreen()?.id
      const layers = getProjectLayers(useProjectStore.getState().project)
      const layer = layers.find((candidate) => candidate.id === id)
      const scopedLayers = layers.filter((candidate) => candidate.scope === layer?.scope)
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
          layoutLayers.map((candidate, index) => ({
            ...candidate,
            zIndex: index,
            scope: 'layout',
          })),
        )
      } else {
        recordCurrent()
        useProjectStore.getState().reorderScreenLayer(screenId, id, newIndex)
      }
      set({ selectedLayerIds: [id] })
    },

    duplicateLayer: (id) => {
      const screenId = activeScreen()?.id
      if (!screenId) return
      const layers = getProjectLayers(useProjectStore.getState().project)
      const source = layers.find((layer) => layer.id === id)
      if (!source) return
      const previousIds = new Set(layers.map((layer) => layer.id))
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
      const duplicate = getProjectLayers(useProjectStore.getState().project).find(
        (layer) => !previousIds.has(layer.id),
      )
      set({
        selectedLayerIds: duplicate ? [duplicate.id] : get().selectedLayerIds,
      })
    },

    setLayerScope: (id, scope) => {
      const project = useProjectStore.getState().project
      const screenId = project?.activeScreenId
      const screenIndex = project?.screens.findIndex((screen) => screen.id === screenId) ?? -1
      if (!project || screenIndex === -1) return
      const screen = project.screens[screenIndex]
      const board = getStoreTargetProfile(project.target).board
      const screenLayer = screen.layers.find((layer) => layer.id === id)
      const layoutLayer = project.layoutLayers.find((layer) => layer.id === id)
      if ((scope === 'layout' && !screenLayer) || (scope === 'screen' && !layoutLayer)) return

      recordProject()
      const moved = structuredClone((screenLayer ?? layoutLayer) as Layer)
      const screens = project.screens.map((candidate) =>
        candidate.id === screenId
          ? {
              ...candidate,
              layers:
                scope === 'layout'
                  ? candidate.layers.filter((layer) => layer.id !== id)
                  : [
                      ...candidate.layers,
                      {
                        ...moved,
                        x: moved.x - screenIndex * board.width,
                        zIndex: moved.zIndex,
                        scope: undefined,
                      },
                    ],
            }
          : candidate,
      )
      const layoutLayers =
        scope === 'layout'
          ? [
              ...project.layoutLayers,
              {
                ...moved,
                x: moved.x + screenIndex * board.width,
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
      set({ selectedLayerIds: [id] })
    },

    setLayers: (layers, options) => {
      const screen = activeScreen()
      if (!screen) return
      recordProject(options?.coalesceKey)
      const project = useProjectStore.getState().project
      if (!project) return
      useProjectStore.setState({
        project: {
          ...project,
          screens: project.screens.map((candidate) =>
            candidate.id === screen.id
              ? { ...candidate, layers: layers.filter((layer) => layer.scope !== 'layout') }
              : candidate,
          ),
          layoutLayers: layers.filter((layer) => layer.scope === 'layout'),
          updatedAt: nextTimestamp(project.updatedAt),
        },
      })
    },

    alignSelection: (mode) => {
      const selected = selectedLayers(get())
      if (selected.length === 0) return
      const layers = getProjectLayers(useProjectStore.getState().project)
      const placements = alignTo(selected, mode, alignmentReference(selected))
      get().setLayers(placeLayers(layers, selected, placements))
    },

    distributeSelection: (mode) => {
      const selected = selectedLayers(get())
      // Deux calques sont déjà « répartis » : il n'y a pas d'intervalle intérieur.
      if (selected.length < 3) return
      const layers = getProjectLayers(useProjectStore.getState().project)
      get().setLayers(placeLayers(layers, selected, distribute(selected, mode)))
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
        const screenId = project.activeScreenId || project.screens[0]?.id
        if (!screenId) return null
        recordCurrent()
        useProjectStore.getState().replaceScreenContent(screenId, template.background, layers)
        set({ selectedLayerIds: [] })
        return screenId
      }

      if (project.screens.length >= getStoreTargetProfile(project.target).maxScreens) return null
      recordProject()
      const screenId = useProjectStore.getState().addScreen({
        name: `${template.name} ${project.screens.length + 1}`,
        background: template.background,
        layers,
      })
      if (!screenId) return null
      set({ selectedLayerIds: [] })
      return screenId
    },

    undo: () => travel('undo'),
    redo: () => travel('redo'),
  }
})

useProjectStore.subscribe((state, previous) => {
  if (state.project?.activeScreenId !== previous.project?.activeScreenId) {
    useCanvasStore.getState().clearSelection()
  }
})
