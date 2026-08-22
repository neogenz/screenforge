import { ActiveSelection, Canvas, Rect, Shadow, Textbox } from 'fabric'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  applyLayerToFabricObject,
  backgroundToFabricFill,
  clipContentToScreen,
  clipControlsToScreen,
  disposeFabricObjectResource,
  getScreenOffset,
  intersectsScreen,
  layerToFabricObject,
  needsFabricObjectRecreation,
  screenLabelGeometry,
  type RenderedObject,
} from '@/lib/canvas/canvas-utils'
import {
  applyLassoColors,
  artboardStyle,
  readChromeColors,
  resolveSelectionObjects,
  sameIds,
} from '@/lib/canvas/canvas-interactions'
import type { ProjectChange } from '@/lib/canvas/project-diff'
import { useCanvasStore } from '@/stores/canvas.store'
import { isFontLoaded, loadGoogleFont } from '@/lib/fonts'
import type { Layer, Project, Screen } from '@/types'

type MutableValue<T> = { current: T }

export type CanvasSyncRuntime = {
  canvas: Canvas
  syncVersion: MutableValue<number>
  syncing: MutableValue<boolean>
  fontLoadRequests: Set<string>
  layoutInstances: MutableValue<Map<string, RenderedObject[]>>
  generateThumbnails: (screens: Screen[]) => void
}

/**
 * Réinstalle le rendu écrêté quand la planche de rattachement change.
 *
 * Le nombre de planches entre dans la garde au même titre que l'index : le
 * fantôme hors planche est écrêté au complément de **toutes** les planches, donc
 * ajouter ou retirer un écran change ce qu'il doit peindre sans qu'aucun calque
 * n'ait bougé.
 */
export function ensureScreenClipPath(
  object: RenderedObject,
  screenIndex: number,
  screenCount: number,
): void {
  if (object.data?.clipScreenIndex === screenIndex && object.data?.clipScreenCount === screenCount)
    return
  clipContentToScreen(object, screenIndex, screenCount)
  clipControlsToScreen(object, screenIndex)
  object.set('data', { ...object.data, clipScreenIndex: screenIndex, clipScreenCount: screenCount })
}

/**
 * Ce qu'un calque doit à la planche qui le porte : son écrêtage, et sa prise.
 *
 * Une seule fonction pour les deux, appelée par les trois chemins qui posent un
 * calque — la synchronisation complète, le patch, et l'instance de gabarit —
 * parce que la prise se réécrit à chaque passe. `applyLayerToFabricObject` ne
 * connaît qu'un décalage, pas une planche, et remet `selectable`/`evented` à
 * `!layer.locked` sans savoir où l'objet a atterri : une décision posée dans le
 * seul chemin de synchronisation serait annulée en silence au patch suivant, à
 * la première flèche du clavier.
 *
 * Perdre la prise n'est pas perdre le calque : la liste des calques le
 * sélectionne toujours — `setActiveObject` ne lit ni l'un ni l'autre drapeau —
 * les flèches le déplacent et le panneau Transformation propose de le ramener.
 * Sur la scène vide, `install-interactions` rend aussi la prise le temps du
 * geste. Ce qu'on lui retire, c'est de répondre à un clic au-dessus de la
 * planche du voisin.
 */
function applyScreenPresence(
  object: RenderedObject,
  layer: Layer,
  screenIndex: number,
  screenCount: number,
): void {
  ensureScreenClipPath(object, screenIndex, screenCount)
  /* Les deux drapeaux, pas un seul : `evented` garde le clic (`_checkTarget`),
     `selectable` garde le lasso (`collectObjects`, qui ignore `evented`). N'en
     poser qu'un laisserait un lasso tiré sur la planche voisine ramasser un
     calque qu'on n'y voit pas — le même défaut, par l'autre porte. */
  const grabbable = !layer.locked && intersectsScreen(object, screenIndex)
  object.set({ selectable: grabbable, evented: grabbable })
}

function applyLayoutInstance(
  object: RenderedObject,
  layer: Layer,
  screenIndex: number,
  screenCount: number,
): void {
  applyLayerToFabricObject(object, layer, getScreenOffset(screenIndex) - screenIndex * SCREEN_WIDTH)
  applyScreenPresence(object, layer, screenIndex, screenCount)
}

/**
 * Demander la police d'un calque, et rien de plus.
 *
 * Ce qu'une police qui arrive fait à la scène ne se décide pas ici : une seule
 * requête part par couple famille+graisse, donc un rappel posé sur cette
 * promesse ne connaîtrait que le premier calque qui l'a demandée. La
 * revalidation est un événement de scène, publié par `fonts.ts` — le seul module
 * qui sait que la mesure a changé — et consommé par `install-fonts`.
 */
function requestLayerFont(layer: Layer, runtime: CanvasSyncRuntime): void {
  if (layer.type !== 'text') return
  const fontKey = `${layer.fontFamily}:${layer.fontWeight}`
  if (isFontLoaded(layer.fontFamily, [String(layer.fontWeight)])) return
  if (runtime.fontLoadRequests.has(fontKey)) return
  runtime.fontLoadRequests.add(fontKey)
  void loadGoogleFont(layer.fontFamily, [String(layer.fontWeight)]).then((result) => {
    if (result.status === 'loaded') return
    /* La clé restait posée pour toujours : une coupure réseau transitoire
       condamnait le calque au repli système, et le chemin patch refusait la
       frappe suivante (police non chargée) — une full sync par caractère.
       On retire la clé : la prochaine édition retentera. */
    runtime.fontLoadRequests.delete(fontKey)
  })
}

export async function syncCanvas(project: Project, runtime: CanvasSyncRuntime): Promise<void> {
  const { canvas } = runtime
  const { screens, layoutLayers, activeScreenId } = project
  const chrome = readChromeColors()
  applyLassoColors(canvas, chrome)
  const version = ++runtime.syncVersion.current
  runtime.syncing.current = true

  try {
    const existingObjects = canvas.getObjects() as RenderedObject[]
    const objectsById = new Map<string, RenderedObject>()
    for (const object of existingObjects) {
      const id = object.data?.uid
      if (!id) continue
      const duplicate = objectsById.get(id)
      if (duplicate) {
        canvas.remove(object)
        disposeFabricObjectResource(object)
      } else {
        objectsById.set(id, object)
      }
    }

    const wantedIds = new Set<string>()
    for (const screen of screens) {
      wantedIds.add(`background:${screen.id}`)
      wantedIds.add(`label:${screen.id}`)
      for (const layer of screen.layers) wantedIds.add(layer.id)
      for (const layer of layoutLayers) wantedIds.add(`layout:${layer.id}:${screen.id}`)
    }
    for (const [id, object] of objectsById) {
      if (wantedIds.has(id)) continue
      canvas.remove(object)
      disposeFabricObjectResource(object)
      objectsById.delete(id)
    }

    /* Tout ce qui doit naître ou renaître se décode en parallèle, avant la
       boucle d'insertion : dix calques image attendaient dix décodages en
       file, chacun borné par le réseau ou le décodeur. Le garde de version
       après le lot protège la suite — un projet plus récent a pu arriver
       pendant les décodages. */
    const toCreate = new Map<string, Layer>()
    for (const screen of screens) {
      for (const layer of screen.layers) {
        const existing = objectsById.get(layer.id)
        if (!existing || needsFabricObjectRecreation(existing, layer)) toCreate.set(layer.id, layer)
      }
      for (const layer of layoutLayers) {
        const layoutId = `layout:${layer.id}:${screen.id}`
        const existing = objectsById.get(layoutId)
        if (!existing || needsFabricObjectRecreation(existing, layer)) toCreate.set(layoutId, layer)
      }
    }
    const created = new Map<string, RenderedObject>()
    /* `allSettled`, pas `all` : un rejet (asset image introuvable) faisait
       rejeter le lot entier, et les objets frères déjà créés — URLs d'objets
       des mockups compris — n'étaient jamais libérés, à chaque full sync tant
       que l'asset manquait. Le calque fautif est simplement absent cette passe. */
    const settled = await Promise.allSettled(
      [...toCreate].map(async ([id, layer]) => {
        const object = await layerToFabricObject(layer)
        created.set(id, object)
      }),
    )
    for (const result of settled) {
      if (result.status === 'rejected')
        console.error('Could not create a canvas object.', result.reason)
    }
    if (runtime.syncVersion.current !== version) {
      for (const object of created.values()) disposeFabricObjectResource(object)
      return
    }
    const takeCreated = (id: string): RenderedObject | undefined => {
      const object = created.get(id)
      if (object) created.delete(id)
      return object
    }

    for (let screenIndex = 0; screenIndex < screens.length; screenIndex += 1) {
      const screen = screens[screenIndex]
      const offset = getScreenOffset(screenIndex)
      const backgroundId = `background:${screen.id}`
      let background = objectsById.get(backgroundId)
      if (!background) {
        background = new Rect({
          originX: 'left',
          originY: 'top',
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          selectable: false,
          evented: false,
          strokeUniform: true,
        })
        background.set('data', {
          uid: backgroundId,
          screenId: screen.id,
          rendererType: 'background',
        })
        canvas.add(background)
        objectsById.set(backgroundId, background)
      }
      const artboard = artboardStyle(chrome, screen.id === activeScreenId)
      background.set({
        left: offset,
        top: 0,
        fill: backgroundToFabricFill(screen.background),
        stroke: artboard.stroke,
        strokeWidth: artboard.strokeWidth,
        shadow: new Shadow(artboard.shadow),
      })
      background.setCoords()

      const labelId = `label:${screen.id}`
      // Le nom de la planche se mesure en pixels écran : `screenLabelGeometry`
      // est la seule origine des deux nombres, ici comme au changement de zoom.
      const labelGeometry = screenLabelGeometry(canvas.getZoom())
      let label = objectsById.get(labelId)
      if (!label) {
        label = new Textbox('', {
          originX: 'left',
          originY: 'top',
          width: SCREEN_WIDTH,
          fontFamily: 'Inter, system-ui, sans-serif',
          selectable: false,
          evented: false,
        })
        label.set('data', {
          uid: labelId,
          screenId: screen.id,
          rendererType: 'label',
        })
        canvas.add(label)
        objectsById.set(labelId, label)
      }
      label.set({
        left: offset,
        ...labelGeometry,
        text: screen.name,
        fill: artboard.labelFill,
      })
      label.setCoords()

      for (const layer of screen.layers) {
        requestLayerFont(layer, runtime)
        let object = objectsById.get(layer.id)
        const replacement = takeCreated(layer.id)
        if (object && replacement) {
          canvas.remove(object)
          disposeFabricObjectResource(object)
          object = replacement
          canvas.add(object)
          objectsById.set(layer.id, object)
        } else if (!object && replacement) {
          object = replacement
          canvas.add(object)
          objectsById.set(layer.id, object)
        } else if (!object) {
          continue
        }

        object.set('data', {
          ...object.data,
          uid: layer.id,
          layerId: layer.id,
          screenId: screen.id,
          screenIndex,
          layout: false,
          rendererType: layer.type,
        })
        applyLayerToFabricObject(object, layer, offset)
        applyScreenPresence(object, layer, screenIndex, screens.length)
      }
    }

    for (const layer of layoutLayers) {
      requestLayerFont(layer, runtime)
      for (let screenIndex = 0; screenIndex < screens.length; screenIndex += 1) {
        const screen = screens[screenIndex]
        const objectId = `layout:${layer.id}:${screen.id}`
        let object = objectsById.get(objectId)
        const replacement = takeCreated(objectId)
        if (object && replacement) {
          canvas.remove(object)
          disposeFabricObjectResource(object)
          object = replacement
          canvas.add(object)
          objectsById.set(objectId, object)
        } else if (!object && replacement) {
          object = replacement
          canvas.add(object)
          objectsById.set(objectId, object)
        } else if (!object) {
          continue
        }

        object.set('data', {
          ...object.data,
          uid: objectId,
          layerId: layer.id,
          screenId: screen.id,
          screenIndex,
          layout: true,
          rendererType: layer.type,
        })
        applyLayoutInstance(object, layer, screenIndex, screens.length)
      }
    }

    /* Par construction chaque objet pré-créé a son point d'insertion ; s'il en
       reste, c'est une divergence entre les deux passes — on les dispose plutôt
       que de laisser fuiter leurs URL. */
    for (const object of created.values()) disposeFabricObjectResource(object)

    const orderedObjects: RenderedObject[] = []
    for (const screen of screens) {
      const background = objectsById.get(`background:${screen.id}`)
      if (background) orderedObjects.push(background)
    }
    for (const screen of screens) {
      const layers = [...screen.layers, ...layoutLayers].sort(
        (left, right) => left.zIndex - right.zIndex,
      )
      for (const layer of layers) {
        const object =
          layer.scope === 'layout'
            ? objectsById.get(`layout:${layer.id}:${screen.id}`)
            : objectsById.get(layer.id)
        if (object) orderedObjects.push(object)
      }
    }
    for (const screen of screens) {
      const label = objectsById.get(`label:${screen.id}`)
      if (label) orderedObjects.push(label)
    }
    const wantedOrder = orderedObjects.map((object) => object.data?.uid ?? '')
    const currentOrder = (canvas.getObjects() as RenderedObject[]).map(
      (object) => object.data?.uid ?? '',
    )
    if (!sameIds(currentOrder, wantedOrder)) {
      orderedObjects.forEach((object, index) => canvas.moveObjectTo(object, index))
    }

    const instances = new Map<string, RenderedObject[]>()
    for (const layer of layoutLayers) {
      instances.set(
        layer.id,
        screens.flatMap((screen) => {
          const object = objectsById.get(`layout:${layer.id}:${screen.id}`)
          return object ? [object] : []
        }),
      )
    }
    runtime.layoutInstances.current = instances

    const selectedIds = useCanvasStore.getState().selectedLayerIds
    const currentSelectionIds = canvas
      .getActiveObjects()
      .map((object) => {
        const data = (object as RenderedObject).data
        return data?.layerId ?? data?.uid
      })
      .filter((id): id is string => Boolean(id))
    const uniqueCurrentIds = [...new Set(currentSelectionIds)]
    if (!sameIds(uniqueCurrentIds, selectedIds)) {
      const selectedObjects = resolveSelectionObjects(project, objectsById, selectedIds)
      if (selectedObjects.length === 0) canvas.discardActiveObject()
      else if (selectedObjects.length === 1) canvas.setActiveObject(selectedObjects[0])
      else canvas.setActiveObject(new ActiveSelection(selectedObjects, { canvas }))
    }

    canvas.requestRenderAll()
    runtime.generateThumbnails(screens)
  } catch (error) {
    console.error('Could not synchronize the canvas.', error)
  } finally {
    if (runtime.syncVersion.current === version) {
      /* La version est relue dans la trame, pas seulement avant : une passe
         suivante peut démarrer entre les deux, et lever le drapeau sous elle
         rendait ses `canvas.remove` visibles au gestionnaire de désélection.
         Retirer l'objet actif effaçait alors la sélection, le panneau des
         propriétés retombait sur l'arrière-plan, et le réglage en cours
         disparaissait sous le curseur. */
      requestAnimationFrame(() => {
        if (runtime.syncVersion.current !== version) return
        runtime.syncing.current = false
      })
    }
  }
}

export async function patchCanvas(
  project: Project,
  change: Extract<ProjectChange, { type: 'patch' }>,
  runtime: CanvasSyncRuntime,
): Promise<boolean> {
  const { canvas } = runtime
  const objectsById = new Map<string, RenderedObject>()
  for (const object of canvas.getObjects() as RenderedObject[]) {
    const id = object.data?.uid
    if (id) objectsById.set(id, object)
  }

  if (change.backgroundChanged) {
    const screen = project.screens.find((candidate) => candidate.id === change.screenId)
    const background = objectsById.get(`background:${change.screenId}`)
    if (!screen || !background) return false
    background.set({ fill: backgroundToFabricFill(screen.background) })
    background.setCoords()
  }

  const screenIndex = project.screens.findIndex((screen) => screen.id === change.screenId)
  if (screenIndex === -1 && change.layerIds.length > 0) return false
  const screen = project.screens[screenIndex]

  /**
   * Remplace un objet dont la ressource a changé sans quitter le chemin patch.
   *
   * Le cadrage d'une capture est écrit dans le raster de l'appareil : chaque
   * tick du curseur de zoom change la clé de ressource. Renoncer ici renvoyait
   * à une réconciliation complète — clip, ordre, vignettes de tous les écrans —
   * soixante fois par seconde de drag. Recréer le seul objet concerné garde le
   * coût du patch : une image à re-décoder, rien d'autre à rebâtir.
   */
  const recreateInPlace = async (
    object: RenderedObject,
    layer: Layer,
    objectId: string,
  ): Promise<RenderedObject | null> => {
    const version = runtime.syncVersion.current
    const replacement = await layerToFabricObject(layer)
    if (runtime.syncVersion.current !== version || !canvas.getObjects().includes(object)) {
      // Un patch concurrent a déjà remplacé l'objet pendant le décodage : cette
      // passe abandonne. Selon l'ordre de résolution, la version restée sur le
      // canvas peut être l'ancienne — c'est le repli full sync du retour
      // `false`, qui relit le projet courant, qui garantit l'état final.
      disposeFabricObjectResource(replacement)
      return null
    }
    const previousData = object.data
    const index = canvas.getObjects().indexOf(object)
    const wasActive = canvas.getActiveObjects().includes(object)
    canvas.remove(object)
    disposeFabricObjectResource(object)
    if (index >= 0) canvas.insertAt(index, replacement)
    else canvas.add(replacement)
    replacement.set('data', {
      ...replacement.data,
      uid: objectId,
      layerId: previousData?.layerId,
      screenId: previousData?.screenId,
      screenIndex: previousData?.screenIndex,
      layout: previousData?.layout ?? false,
    })
    objectsById.set(objectId, replacement)
    if (wasActive) {
      const active = canvas.getActiveObject()
      if (active instanceof ActiveSelection) {
        active.add(replacement)
        canvas.requestRenderAll()
      } else {
        canvas.setActiveObject(replacement)
      }
    }
    return replacement
  }

  for (const layerId of change.layerIds) {
    const layer = screen.layers.find((candidate) => candidate.id === layerId)
    const object = objectsById.get(layerId)
    if (!layer || !object) return false
    let target = object
    if (needsFabricObjectRecreation(object, layer)) {
      const replacement = await recreateInPlace(object, layer, layerId)
      if (!replacement) return false
      target = replacement
    }
    if (layer.type === 'text' && !isFontLoaded(layer.fontFamily, [String(layer.fontWeight)]))
      return false
    applyLayerToFabricObject(target, layer, getScreenOffset(screenIndex))
    applyScreenPresence(target, layer, screenIndex, project.screens.length)
  }

  for (const layerId of change.layoutLayerIds) {
    const layer = project.layoutLayers.find((candidate) => candidate.id === layerId)
    if (!layer) return false
    if (layer.type === 'text' && !isFontLoaded(layer.fontFamily, [String(layer.fontWeight)]))
      return false
    for (let index = 0; index < project.screens.length; index += 1) {
      const objectId = `layout:${layerId}:${project.screens[index].id}`
      const object = objectsById.get(objectId)
      if (!object) return false
      let target = object
      if (needsFabricObjectRecreation(object, layer)) {
        const replacement = await recreateInPlace(object, layer, objectId)
        if (!replacement) return false
        target = replacement
      }
      applyLayoutInstance(target, layer, index, project.screens.length)
    }
  }

  canvas.requestRenderAll()
  runtime.generateThumbnails(project.screens)
  return true
}
