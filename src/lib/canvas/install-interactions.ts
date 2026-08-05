import { ActiveSelection, Canvas, Textbox } from 'fabric'
import {
  SNAP_DISTANCE_PX,
  boxOf,
  collectSnapTargets,
  drawGuides,
  readSelectionFrame,
  resolveSelectionObjects,
  sameFrame,
  sameIds,
  screenIndexAtPoint,
  type SelectionFrame,
} from '@/lib/canvas/canvas-interactions'
import { ensureScreenClipPath } from '@/lib/canvas/canvas-sync'
import {
  SCREEN_WIDTH,
  fabricObjectToLayerUpdate,
  getScreenOffset,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import { applyLayerTransfer } from '@/lib/layer-transfer'
import type { LayoutLayerUpdate, LocalLayerTransfer } from '@/lib/layer-transfer'
import { computeSnap } from '@/lib/snapping'
import type { Box, Guide } from '@/lib/snapping'
import { nextTimestamp } from '@/lib/time'
import type { Layer, Project } from '@/types'

interface MutableValue<T> {
  current: T
}

interface InteractionInstallerOptions {
  canvas: Canvas
  syncing: MutableValue<boolean>
  selectionFromCanvas: MutableValue<boolean>
  layoutInstances: MutableValue<Map<string, RenderedObject[]>>
  getProject: () => Project | null
  setProject: (project: Project) => void
  setActiveScreenId: (screenId: string) => void
  getSelectedLayerIds: () => string[]
  subscribeSelection: (
    listener: (selectedIds: string[], previousIds: string[]) => void,
  ) => () => void
  recordHistory: () => void
  recordProjectHistory: () => void
  selectLayer: (layerId: string) => void
  selectLayers: (layerIds: string[]) => void
  clearSelection: () => void
  updateLayer: (layerId: string, updates: Partial<Layer>) => void
  onSelectionFrame: (frame: SelectionFrame | null) => void
}

export function installInteractions({
  canvas,
  syncing,
  selectionFromCanvas,
  layoutInstances,
  getProject,
  setProject,
  setActiveScreenId,
  getSelectedLayerIds,
  subscribeSelection,
  recordHistory,
  recordProjectHistory,
  selectLayer,
  selectLayers,
  clearSelection,
  updateLayer,
  onSelectionFrame,
}: InteractionInstallerOptions): () => void {
  let ignoreSelectionCleared = false
  let interacting = false
  let applyingStoreSelection = false
  let publishedFrame: SelectionFrame | null = null
  let guides: Guide[] = []
  let snapTargets: Box[] | null = null
  const dragSourceScreenIndexes = new Map<RenderedObject, number>()
  const mirrorLast = new Map<string, { left: number; top: number }>()

  function syncTextCursors(): void {
    const active = new Set(canvas.getActiveObjects())
    for (const object of canvas.getObjects() as RenderedObject[]) {
      if (object.data?.rendererType !== 'text' || !object.selectable) continue
      object.hoverCursor = active.has(object) ? 'text' : 'move'
    }
  }

  function handleSelection(): void {
    syncTextCursors()
    if (syncing.current || applyingStoreSelection) return
    const renderedObjects = canvas.getActiveObjects() as RenderedObject[]
    const ids = [
      ...new Set(
        renderedObjects.flatMap((object) => {
          const id = object.data?.layerId ?? object.data?.uid
          return id ? [id] : []
        }),
      ),
    ]
    const screenId = renderedObjects.find((object) => object.data?.screenId)?.data?.screenId
    if (screenId && screenId !== getProject()?.activeScreenId) {
      selectionFromCanvas.current = true
      setActiveScreenId(screenId)
    }
    if (ids.length === 1) selectLayer(ids[0])
    else if (ids.length > 1) selectLayers(ids)
  }

  function applyStoreSelection(): void {
    const project = getProject()
    if (!project) return
    const objectsById = new Map<string, RenderedObject>()
    for (const object of canvas.getObjects() as RenderedObject[]) {
      if (object.data?.uid) objectsById.set(object.data.uid, object)
    }
    const targets = resolveSelectionObjects(project, objectsById, getSelectedLayerIds())
    const activeObjects = canvas.getActiveObjects() as RenderedObject[]
    if (
      activeObjects.length === targets.length &&
      targets.every((target) => activeObjects.includes(target))
    )
      return
    applyingStoreSelection = true
    if (targets.length === 0) canvas.discardActiveObject()
    else if (targets.length === 1) canvas.setActiveObject(targets[0])
    else canvas.setActiveObject(new ActiveSelection(targets, { canvas }))
    syncTextCursors()
    canvas.requestRenderAll()
    queueMicrotask(() => {
      applyingStoreSelection = false
    })
  }

  const disposeModified = canvas.on('object:modified', (event) => {
    if (syncing.current || !event.target) return
    const target = event.target
    const objects =
      target instanceof ActiveSelection
        ? (target.getObjects() as RenderedObject[])
        : [target as RenderedObject]
    const project = getProject()
    if (!project) return
    objects.sort(
      (a, b) =>
        Number(a.data?.screenId === project.activeScreenId) -
        Number(b.data?.screenId === project.activeScreenId),
    )

    const dropScreenIndex =
      event.action === 'drag' ? screenIndexAtPoint(project.screens, target.getCenterPoint()) : null
    const localUpdates: LocalLayerTransfer[] = []
    const layoutUpdates: LayoutLayerUpdate[] = []
    for (const object of objects) {
      const layerId = object.data?.layerId ?? object.data?.uid
      const screenId = object.data?.screenId
      if (!layerId || !screenId) continue
      const screenIndex = project.screens.findIndex((screen) => screen.id === screenId)
      if (screenIndex === -1) continue
      if (object.data?.layout) {
        layoutUpdates.push({
          layerId,
          update: fabricObjectToLayerUpdate(
            object,
            getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH,
          ) as Partial<Layer>,
        })
        continue
      }
      const sourceScreenIndex = dragSourceScreenIndexes.get(object) ?? screenIndex
      const targetScreenIndex = dropScreenIndex ?? sourceScreenIndex
      const targetScreen = project.screens[targetScreenIndex]
      const layer = project.screens[screenIndex].layers.find(
        (candidate) => candidate.id === layerId,
      )
      if (!targetScreen || !layer) continue
      if (dropScreenIndex === null && object.data?.screenIndex !== sourceScreenIndex) {
        object.set('data', { ...object.data, screenIndex: sourceScreenIndex })
        ensureScreenClipPath(object, sourceScreenIndex)
      }
      localUpdates.push({
        layer,
        sourceScreenId: screenId,
        targetScreenId: targetScreen.id,
        update: fabricObjectToLayerUpdate(
          object,
          getScreenOffset(targetScreenIndex),
        ) as Partial<Layer>,
      })
    }
    if (localUpdates.length === 0 && layoutUpdates.length === 0) return

    const transfer = localUpdates.find((change) => change.sourceScreenId !== change.targetScreenId)
    const affectedScreenIds = new Set(
      localUpdates.flatMap((change) => [change.sourceScreenId, change.targetScreenId]),
    )
    const changesProjectLayout =
      layoutUpdates.length > 0 || Boolean(transfer) || affectedScreenIds.size > 1
    if (changesProjectLayout) recordProjectHistory()
    else recordHistory()

    if (target instanceof ActiveSelection) {
      ignoreSelectionCleared = true
      canvas.discardActiveObject()
      queueMicrotask(() => {
        ignoreSelectionCleared = false
      })
    }

    const next = applyLayerTransfer({
      screens: project.screens,
      layoutLayers: project.layoutLayers,
      localTransfers: localUpdates,
      layoutUpdates,
    })
    const destinationScreenId = next.destinationScreenId
    if (destinationScreenId && destinationScreenId !== project.activeScreenId) {
      selectionFromCanvas.current = true
    }
    setProject({
      ...project,
      activeScreenId: destinationScreenId ?? project.activeScreenId,
      screens: next.screens,
      layoutLayers: next.layoutLayers,
      updatedAt: nextTimestamp(project.updatedAt),
    })
    if (destinationScreenId) {
      selectLayers([
        ...new Set(
          objects.flatMap((object) => {
            const id = object.data?.layerId ?? object.data?.uid
            return id ? [id] : []
          }),
        ),
      ])
    }
    dragSourceScreenIndexes.clear()
  })

  const unsubscribeSelection = subscribeSelection((selectedIds, previousIds) => {
    if (sameIds(selectedIds, previousIds) || interacting || syncing.current) return
    applyStoreSelection()
  })

  const handleDomMouseDown = () => {
    interacting = true
  }
  const handleDomMouseUp = () => {
    interacting = false
  }
  canvas.upperCanvasEl.addEventListener('mousedown', handleDomMouseDown, true)
  window.addEventListener('mouseup', handleDomMouseUp, true)

  const disposeAfterRender = canvas.on('after:render', () => {
    if (guides.length > 0) drawGuides(canvas, guides)
    const next = interacting ? null : readSelectionFrame(canvas)
    if (sameFrame(next, publishedFrame)) return
    publishedFrame = next
    onSelectionFrame(next)
  })

  const disposeMoving = canvas.on('object:moving', (event) => {
    const target = event.target as RenderedObject | undefined
    if (!target) return
    const members =
      target instanceof ActiveSelection ? (target.getObjects() as RenderedObject[]) : [target]
    const localMembers = members.filter((object) => !object.data?.layout)
    for (const object of localMembers) {
      const sourceIndex = object.data?.screenIndex
      if (sourceIndex !== undefined && !dragSourceScreenIndexes.has(object)) {
        dragSourceScreenIndexes.set(object, sourceIndex)
      }
    }
    const targetScreenIndex = screenIndexAtPoint(
      getProject()?.screens ?? [],
      target.getCenterPoint(),
    )
    if (
      targetScreenIndex !== null &&
      localMembers.some((object) => object.data?.screenIndex !== targetScreenIndex)
    ) {
      for (const object of localMembers) {
        object.set('data', { ...object.data, screenIndex: targetScreenIndex })
        ensureScreenClipPath(object, targetScreenIndex)
      }
      snapTargets = null
    }

    const pointerEvent = event.e as MouseEvent | TouchEvent
    const freehand = 'metaKey' in pointerEvent && (pointerEvent.metaKey || pointerEvent.ctrlKey)
    if (freehand) {
      guides = []
    } else {
      snapTargets ??= collectSnapTargets(canvas, target)
      const snap = computeSnap(boxOf(target), snapTargets, SNAP_DISTANCE_PX / canvas.getZoom())
      if (snap.dx !== 0 || snap.dy !== 0) {
        target.set({ left: target.left + snap.dx, top: target.top + snap.dy })
        target.setCoords()
      }
      guides = snap.guides
    }

    if (target instanceof ActiveSelection || !target.data?.layout) return
    const layerId = target.data.layerId
    if (!layerId) return
    const last = mirrorLast.get(layerId) ?? { left: target.left, top: target.top }
    const dx = target.left - last.left
    const dy = target.top - last.top
    mirrorLast.set(layerId, { left: target.left, top: target.top })
    if (dx === 0 && dy === 0) return
    for (const object of layoutInstances.current.get(layerId) ?? []) {
      if (object === target) continue
      object.set({ left: object.left + dx, top: object.top + dy })
      object.setCoords()
    }
    canvas.requestRenderAll()
  })

  const disposeMouseUp = canvas.on('mouse:up', () => {
    mirrorLast.clear()
    dragSourceScreenIndexes.clear()
    guides = []
    snapTargets = null
    interacting = false
    applyStoreSelection()
    canvas.requestRenderAll()
  })

  const disposeTextExit = canvas.on('text:editing:exited', (event) => {
    const target = event.target as RenderedObject | undefined
    if (!target || !(target instanceof Textbox)) return
    const data = (target as RenderedObject).data
    const layerId = data?.layerId ?? data?.uid
    if (!layerId) return
    const project = getProject()
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
      (candidate) => candidate.id === layerId,
    )
    if (layer?.type === 'text' && layer.content !== target.text) {
      updateLayer(layerId, { content: target.text })
    }
  })

  const disposeSelectionCreated = canvas.on('selection:created', handleSelection)
  const disposeSelectionUpdated = canvas.on('selection:updated', handleSelection)
  const disposeSelectionCleared = canvas.on('selection:cleared', () => {
    if (ignoreSelectionCleared || applyingStoreSelection) return
    if (!syncing.current) clearSelection()
  })

  function handleKeyDown(event: KeyboardEvent): void {
    const element = document.activeElement as HTMLElement | null
    if (
      element &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable)
    )
      return
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.shiftKey) return
    const target = canvas.getActiveObject()
    if (!(target instanceof Textbox) || !target.selectable) return
    event.preventDefault()
    target.enterEditing()
    target.selectAll()
    canvas.requestRenderAll()
  }
  window.addEventListener('keydown', handleKeyDown)

  return () => {
    disposeModified()
    disposeAfterRender()
    disposeMoving()
    disposeMouseUp()
    disposeTextExit()
    disposeSelectionCreated()
    disposeSelectionUpdated()
    disposeSelectionCleared()
    unsubscribeSelection()
    canvas.upperCanvasEl.removeEventListener('mousedown', handleDomMouseDown, true)
    window.removeEventListener('mouseup', handleDomMouseUp, true)
    window.removeEventListener('keydown', handleKeyDown)
  }
}
