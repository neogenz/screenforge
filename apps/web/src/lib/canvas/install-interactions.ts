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
  intersectsScreen,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import { applyLayerTransfer } from '@/lib/layer-transfer'
import type { LayoutLayerUpdate, LocalLayerTransfer } from '@/lib/layer-transfer'
import { computeSnap } from '@/lib/snapping'
import type { Box, Guide } from '@/lib/snapping'
import { readCharStyles, sameCharStyles } from '@/lib/text-styles'
import type { TextRange } from '@/lib/text-styles'
import { nextTimestamp } from '@/lib/time'
import type { Layer, Project, TextLayer } from '@/types'

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
  setTextRange: (range: TextRange | null) => void
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
  setTextRange,
}: InteractionInstallerOptions): () => void {
  let ignoreSelectionCleared = false
  let interacting = false
  let applyingStoreSelection = false
  let publishedFrame: SelectionFrame | null = null
  let guides: Guide[] = []
  let snapTargets: Box[] | null = null
  let stageRecovery: RenderedObject | null = null
  const dragSourceScreenIndexes = new Map<RenderedObject, number>()
  const mirrorLast = new Map<string, { left: number; top: number }>()

  /**
   * Le sosie : ce qu'on voit rester en place pendant qu'on tire une copie.
   *
   * Sans lui, Option-glisser fait exactement le bon travail et le montre à
   * l'envers. L'objet tiré est celui du calque d'origine, la copie n'est écrite
   * qu'au lâcher : on voit donc l'original quitter sa place, un trou derrière
   * lui, puis deux apparitions au relâchement. Or ce geste sert à poser une
   * copie *à un décalage choisi de l'original*, et on ne peut pas viser un
   * décalage par rapport à quelque chose qu'on a sous le curseur.
   *
   * Le sosie est un objet Fabric et rien d'autre : aucun calque, aucune
   * écriture dans le projet, pas de `data.layerId` — `clone()` ne recopie que
   * ce qu'on lui nomme, et on ne lui nomme rien. Il est donc invisible à tout
   * ce qui indexe par calque, et une réconciliation complète ne peut pas le
   * détruire puisqu'elle ne le connaît pas. C'est ce qui permet de montrer la
   * duplication pendant le geste sans rien écrire pendant le geste.
   *
   * Il est posé à la position de départ mémorisée au `mouse:down`, et non
   * relue du calque : au moment où Alt est constatée l'objet a déjà bougé, et
   * le calque n'a pas encore changé — les deux disent la même chose ici, mais
   * la position de départ est la seule qui reste vraie si une passe de
   * synchronisation tombe au milieu.
   *
   * Un seul objet, pas une sélection multiple : replacer les membres d'une
   * `ActiveSelection` demande de repasser par la matrice du groupe, et
   * personne n'a demandé à dupliquer six calques d'un glissement. Le cas
   * multiple garde donc l'ancien comportement — la copie paraît au lâcher.
   */
  const dragOrigin = new Map<RenderedObject, { left: number; top: number }>()
  let ghost: RenderedObject | null = null
  let ghostPending = false
  let ghostGesture = 0

  function dropGhost() {
    if (!ghost && !ghostPending) return
    if (ghost) canvas.remove(ghost)
    ghost = null
    ghostPending = false
    // Un clone encore en vol appartient au geste précédent : il se jettera.
    ghostGesture += 1
    canvas.requestRenderAll()
  }

  function raiseGhost(source: RenderedObject) {
    if (ghost || ghostPending) return
    const origin = dragOrigin.get(source)
    const screenIndex = source.data?.screenIndex
    if (!origin || screenIndex === undefined) return
    const gesture = ghostGesture
    ghostPending = true
    void source
      .clone()
      .then((copy) => {
        if (gesture !== ghostGesture) return
        const stand = copy as RenderedObject
        stand.set({
          left: origin.left,
          top: origin.top,
          selectable: false,
          evented: false,
          excludeFromExport: true,
        })
        stand.objectCaching = false
        stand.setCoords()
        ensureScreenClipPath(stand, screenIndex, getProject()?.screens.length ?? 1)
        // Au rang de l'original : une copie tirée par-dessus doit passer
        // devant lui, jamais derrière un calque qui les sépare tous les deux.
        canvas.insertAt(canvas.getObjects().indexOf(source), stand)
        ghost = stand
        canvas.requestRenderAll()
      })
      .catch(() => undefined)
      .finally(() => {
        ghostPending = false
      })
  }

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

  /**
   * Le rang le plus haut d'un écran, calques de gabarit compris.
   *
   * Compris, parce que les deux familles partagent une seule échelle de `zIndex`
   * et qu'une copie posée sous un gabarit disparaîtrait derrière lui.
   */
  function topZIndex(screen: Project['screens'][number], project: Project): number {
    return Math.max(
      -1,
      ...screen.layers.map((layer) => layer.zIndex),
      ...project.layoutLayers.map((layer) => layer.zIndex),
    )
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
        ensureScreenClipPath(object, sourceScreenIndex, project.screens.length)
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

    /**
     * Option (Alt) au lâcher : on dépose une copie, l'original ne bouge pas.
     *
     * La touche est lue au relâchement et non à l'appui, comme le Finder : c'est
     * celle qu'on tient au moment de lâcher qui décide, donc on peut l'enfoncer
     * ou la relâcher en cours de geste. Restreint à `drag` parce que Fabric
     * réserve déjà Alt au redimensionnement centré — un coin tiré touche autre
     * chose qu'une position, et le doubler d'une duplication rendrait les deux
     * gestes imprévisibles.
     *
     * Rien n'est écrit pendant le geste : ajouter un calque change le nombre de
     * calques de l'écran, ce que `diffProjectChange` classe en `full`, et une
     * réconciliation complète détruirait l'objet Fabric qu'on est en train de
     * tirer. On laisse donc le glissement se terminer, puis on écrit la copie à
     * la position lâchée en laissant l'original à la sienne — la passe de
     * synchronisation qui suit remet l'objet tiré là où son calque est resté et
     * fait apparaître la copie sous le curseur. Les deux étant identiques, rien
     * ne saute à l'œil. Le sosie tient la place de l'original pendant ce
     * temps-là, et c'est lui qui rend le geste lisible : voir `raiseGhost`.
     *
     * Le sosie décide aussi. Il est ce que l'utilisateur a vu, donc le lâcher
     * produit ce qui était montré, même s'il a relâché Alt sans plus bouger la
     * souris entre-temps. La touche n'est relue que pour la sélection multiple,
     * qui n'a pas de sosie.
     *
     * Un gabarit est exclu : il est déjà partagé par tous les écrans, le
     * dupliquer par un glissement ne veut rien dire de précis. Une sélection qui
     * en mêle un se déplace normalement, plutôt que de n'appliquer que la moitié
     * du geste.
     */
    const duplicating =
      event.action === 'drag' &&
      layoutUpdates.length === 0 &&
      (ghost !== null || Boolean((event.e as MouseEvent | undefined)?.altKey))

    if (duplicating) {
      recordProjectHistory()
      if (target instanceof ActiveSelection) {
        ignoreSelectionCleared = true
        canvas.discardActiveObject()
        queueMicrotask(() => {
          ignoreSelectionCleared = false
        })
      }
      const copiesByScreen = new Map<string, Layer[]>()
      const copyIds: string[] = []
      for (const change of localUpdates) {
        const copy = {
          ...structuredClone(change.layer),
          ...change.update,
          id: crypto.randomUUID(),
          name: `${change.layer.name} copie`,
        } as Layer
        copyIds.push(copy.id)
        copiesByScreen.set(change.targetScreenId, [
          ...(copiesByScreen.get(change.targetScreenId) ?? []),
          copy,
        ])
      }
      const dropScreenId = localUpdates[0].targetScreenId
      if (dropScreenId !== project.activeScreenId) selectionFromCanvas.current = true
      setProject({
        ...project,
        activeScreenId: dropScreenId,
        screens: project.screens.map((screen) => {
          const copies = copiesByScreen.get(screen.id)
          if (!copies) return screen
          const top = topZIndex(screen, project)
          return {
            ...screen,
            layers: [
              ...screen.layers,
              ...copies.map((copy, index) => ({ ...copy, zIndex: top + index + 1 })),
            ],
          }
        }),
        updatedAt: nextTimestamp(project.updatedAt),
      })
      selectLayers(copyIds)
      dragSourceScreenIndexes.clear()
      return
    }

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

  const handleDomMouseDown = (event: MouseEvent) => {
    interacting = true
    const project = getProject()
    if (!project) return
    const point = canvas.getScenePoint(event)
    // Une planche garde la priorité absolue : un fantôme ne doit jamais voler
    // le clic d'un calque réellement posé dessus.
    if (screenIndexAtPoint(project.screens, point) !== null) return

    const unlocked = new Set(
      [...project.screens.flatMap((screen) => screen.layers), ...project.layoutLayers]
        .filter((layer) => !layer.locked)
        .map((layer) => layer.id),
    )
    const ghost = [...(canvas.getObjects() as RenderedObject[])].reverse().find((object) => {
      const id = object.data?.layerId ?? object.data?.uid
      return (
        Boolean(id && unlocked.has(id)) &&
        object.data?.screenIndex !== undefined &&
        !object.evented &&
        !object.selectable &&
        object.visible &&
        object.containsPoint(point)
      )
    })
    if (!ghost) return

    // Fabric doit voir une cible normale pendant ce seul geste. Au repos elle
    // reste hors du hit-test et du lasso, comme avant.
    stageRecovery = ghost
    ghost.set({ selectable: true, evented: true })
  }
  const handleDomMouseUp = () => {
    interacting = false
    const recovered = stageRecovery
    stageRecovery = null
    if (!recovered) return
    queueMicrotask(() => {
      const project = getProject()
      const id = recovered.data?.layerId ?? recovered.data?.uid
      const screenIndex = recovered.data?.screenIndex
      const unlocked = Boolean(
        id &&
        project &&
        [...project.screens.flatMap((screen) => screen.layers), ...project.layoutLayers].some(
          (layer) => layer.id === id && !layer.locked,
        ),
      )
      const grabbable =
        unlocked && screenIndex !== undefined && intersectsScreen(recovered, screenIndex)
      recovered.set({ selectable: grabbable, evented: grabbable })
      canvas.requestRenderAll()
    })
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
    const screens = getProject()?.screens ?? []
    const targetScreenIndex = screenIndexAtPoint(screens, target.getCenterPoint())
    if (
      targetScreenIndex !== null &&
      localMembers.some((object) => object.data?.screenIndex !== targetScreenIndex)
    ) {
      for (const object of localMembers) {
        object.set('data', { ...object.data, screenIndex: targetScreenIndex })
        ensureScreenClipPath(object, targetScreenIndex, screens.length)
      }
      snapTargets = null
    }

    const pointerEvent = event.e as MouseEvent | TouchEvent
    // Le curseur dit qu'on copie, le sosie dit *ce* qu'on copie. Fabric relit
    // `moveCursor` à chaque déplacement, donc le poser ici suffit ; le sosie
    // paraît et disparaît avec la touche, si bien qu'enfoncer ou relâcher Alt
    // en cours de geste montre à chaque fois ce que le lâcher produira.
    const copying = 'altKey' in pointerEvent && pointerEvent.altKey
    canvas.moveCursor = copying ? 'copy' : 'move'
    if (copying && !(target instanceof ActiveSelection) && !target.data?.layout) raiseGhost(target)
    else if (!copying) dropGhost()
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

  /**
   * La position de départ, prise avant que quoi que ce soit ne bouge.
   *
   * `object:moving` est déjà trop tard — il rend compte d'un déplacement fait.
   */
  const disposeMouseDown = canvas.on('mouse:down', (event) => {
    dragOrigin.clear()
    const target = event.target as RenderedObject | undefined
    if (!target || target instanceof ActiveSelection || target.data?.layout) return
    dragOrigin.set(target, { left: target.left, top: target.top })
  })

  const disposeMouseUp = canvas.on('mouse:up', () => {
    canvas.moveCursor = 'move'
    // Après `object:modified`, qui a lu sa présence : Fabric clôt la transformation
    // avant d'annoncer le relâchement.
    dropGhost()
    dragOrigin.clear()
    mirrorLast.clear()
    dragSourceScreenIndexes.clear()
    guides = []
    snapTargets = null
    interacting = false
    applyStoreSelection()
    canvas.requestRenderAll()
  })

  function editedTextLayerId(target: unknown): string | null {
    if (!(target instanceof Textbox)) return null
    const data = (target as RenderedObject).data
    return data?.layerId ?? data?.uid ?? null
  }

  const disposeTextExit = canvas.on('text:editing:exited', (event) => {
    setTextRange(null)
    const target = event.target as RenderedObject | undefined
    const layerId = editedTextLayerId(target)
    if (!layerId || !(target instanceof Textbox)) return
    const project = getProject()
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
      (candidate) => candidate.id === layerId,
    )
    if (layer?.type !== 'text') return
    const updates: Partial<TextLayer> = {}
    if (layer.content !== target.text) updates.content = target.text
    // Fabric a décalé les styles de caractère au fil de la frappe : insérer un
    // mot au milieu d'un passage coloré pousse ses index avec lui. On relit
    // donc l'objet plutôt que de recalculer — et on ne réécrit que si quelque
    // chose a bougé, sinon chaque sortie d'édition déposerait un pas d'annulation.
    const charStyles = readCharStyles(target.styles)
    if (!sameCharStyles(charStyles, layer.charStyles)) updates.charStyles = charStyles
    if (Object.keys(updates).length > 0) updateLayer(layerId, updates as Partial<Layer>)
  })

  /**
   * Le passage sélectionné dans le texte, publié pour les contrôles de couleur.
   *
   * Le panneau ne connaît pas Fabric et n'a pas à le connaître : il lit un
   * intervalle dans le store, écrit dans le calque, et la passe de synchro
   * repose les styles sur l'objet. C'est le même aller-retour que pour toutes
   * les autres propriétés — la sélection de texte est juste la seule qui ne
   * puisse venir que du canevas.
   */
  const disposeTextSelection = canvas.on('text:selection:changed', (event) => {
    const target = event.target
    const layerId = editedTextLayerId(target)
    if (!layerId || !(target instanceof Textbox)) return
    const { selectionStart, selectionEnd } = target
    setTextRange(
      selectionEnd > selectionStart ? { layerId, start: selectionStart, end: selectionEnd } : null,
    )
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
    disposeMouseDown()
    disposeMouseUp()
    disposeTextExit()
    disposeTextSelection()
    disposeSelectionCreated()
    disposeSelectionUpdated()
    disposeSelectionCleared()
    unsubscribeSelection()
    canvas.upperCanvasEl.removeEventListener('mousedown', handleDomMouseDown, true)
    window.removeEventListener('mouseup', handleDomMouseUp, true)
    window.removeEventListener('keydown', handleKeyDown)
  }
}
