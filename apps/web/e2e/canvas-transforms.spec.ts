import { test, expect, type Page } from '@playwright/test'
import {
  activeObjectState,
  activeCenter,
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  dragActiveBody,
  dragControl,
  expectClose,
  findObject,
  lassoOverScreen,
  layerRows,
  screenCenter,
  transformInput,
  waitForApp,
  waitForCanvasSettled,
  type DebugObject,
  fillNumber,
} from './helpers'

async function dragSelectionToScreen(page: Page, screenIndex: number): Promise<void> {
  const [start, destination] = await Promise.all([
    activeCenter(page),
    screenCenter(page, screenIndex),
  ])
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(destination.x, destination.y, { steps: 12 })
  await page.mouse.up()
  await waitForCanvasSettled(page)
}

/**
 * Le centre de chaque calque dans le repère de la scène, lu par la matrice.
 *
 * Par la matrice et non par `left`/`top` : ceux-ci se lisent dans le repère du
 * parent, et un calque pris dans une sélection multiple en a un. C'est
 * précisément la confusion que ces tests surveillent.
 */
async function sceneCenters(page: Page): Promise<{ x: number; y: number }[]> {
  return page.evaluate(() =>
    (window.__sfCanvas?.getObjects() ?? [])
      .filter((object) => {
        const type = (object as DebugObject).data?.rendererType
        return type !== undefined && type !== 'background' && type !== 'label'
      })
      .map((object) => {
        const [, , , , x, y] = object.calcTransformMatrix()
        return { x: Math.round(x), y: Math.round(y) }
      }),
  )
}

/** Les calques de l'écran courant, tels que le projet les garde. */
async function screenLayers(
  page: Page,
): Promise<{ id: string; name: string; x: number; y: number }[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    return (screen?.layers ?? []).map((layer) => ({
      id: layer.id,
      name: layer.name,
      x: Math.round(layer.x),
      y: Math.round(layer.y),
    }))
  })
}

async function selectedLayerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [])
}

async function historyDepth(page: Page): Promise<number> {
  return page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? -1)
}

async function setRotation(page: Page, angle: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Rotation' })
  await slider.focus()
  await slider.press('Home')
  for (let step = 0; step < angle; step += 1) await slider.press('ArrowRight')
}

/**
 * The reported bug: selection handles drift away from the layer after
 * transforms. These specs assert the object stays stable through the full
 * canvas → store → sync round-trip (no jump after releasing the mouse).
 */

test.describe('canvas transforms', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('panel rotation keeps position and aligns controls', async ({ page }) => {
    await addDeviceLayer(page)
    const before = await activeObjectState(page)
    expect(before).not.toBeNull()

    await setRotation(page, 30)
    await waitForCanvasSettled(page)

    const after = await activeObjectState(page)
    expectClose(after!.angle, 30, 0.5)
    expectClose(after!.left, before!.left, 0.5)
    expectClose(after!.top, before!.top, 0.5)
  })

  test('scrubbing position X stays aligned through the store sync', async ({ page }) => {
    await addDeviceLayer(page)
    const before = await page.evaluate(() => {
      const state = window.__sfStores?.useCanvasStore.getState()
      const id = state?.selectedLayerIds[0]
      const project = window.__sfStores?.useProjectStore.getState().project
      const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
      const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
        (candidate) => candidate.id === id,
      )
      const object = window.__sfCanvas
        ?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
      return {
        id,
        x: layer?.x,
        y: layer?.y,
        renderedX: object?.left,
        selectedIds: state?.selectedLayerIds ?? [],
      }
    })
    expect(before.id).toBeTruthy()

    // Amené sous les yeux avant d'être mesuré : ce test pilote la souris en
    // coordonnées absolues, donc la surface de scrub doit être dans la zone
    // visible du panneau. La section Transformation ferme désormais le panneau,
    // derrière la section du type — pour un cadre d'appareil elle tombe 253px
    // sous le pli d'une fenêtre de 900, et la mesure rendait alors la boîte
    // d'un élément écrêté, donc un glissement dans le vide.
    const scrubBox = await transformInput(page, 0).evaluate((input) => {
      // La surface de scrub coss est le libellé (`NumberFieldScrubArea`), pas le champ.
      const surface = input
        .closest('[data-slot="unit-field"]')
        ?.querySelector('[data-slot="number-field-scrub-area"]')
      surface?.scrollIntoView({ block: 'center' })
      const rect = surface?.getBoundingClientRect()
      if (!rect) throw new Error('Scrub surface missing')
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    })
    const start = {
      x: scrubBox.x + scrubBox.width / 2,
      y: scrubBox.y + scrubBox.height / 2,
    }
    // Ce test couvre notre round-trip store/canvas, pas le pointer-lock de Base UI.
    // Son chemin de repli garde les mouvements Playwright déterministes en CI.
    await page.evaluate(() => {
      document.body.requestPointerLock = () => {
        throw new DOMException('Pointer lock disabled by E2E', 'NotAllowedError')
      }
    })
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 24, start.y, { steps: 6 })
    await page.mouse.up()

    async function readState() {
      return page.evaluate((id) => {
        const state = window.__sfStores?.useCanvasStore.getState()
        const project = window.__sfStores?.useProjectStore.getState().project
        const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
        const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
          (candidate) => candidate.id === id,
        )
        const object = window.__sfCanvas
          ?.getObjects()
          .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
        return {
          x: layer?.x,
          y: layer?.y,
          renderedX: object?.left,
          selectedIds: state?.selectedLayerIds ?? [],
        }
      }, before.id!)
    }

    const immediate = await readState()
    expectClose(immediate.x!, before.x! + 24, 1)
    expectClose(immediate.y!, before.y!, 0.01)
    expectClose(immediate.renderedX! - before.renderedX!, immediate.x! - before.x!, 1)
    expect(immediate.selectedIds).toEqual([before.id])

    await waitForCanvasSettled(page)
    const settled = await readState()
    expectClose(settled.x!, immediate.x!, 0.01)
    expectClose(settled.y!, immediate.y!, 0.01)
    expectClose(settled.renderedX!, immediate.renderedX!, 0.5)
    expect(settled.selectedIds).toEqual([before.id])
  })

  test('canvas rotation does not jump after sync', async ({ page }) => {
    await addDeviceLayer(page)
    await dragControl(page, 'mtr', 40, 0)
    // Immediately after release (pre-sync) and after the store round-trip.
    const immediate = await activeObjectState(page)
    await waitForCanvasSettled(page)
    const settled = await activeObjectState(page)
    expect(immediate!.angle).toBeGreaterThan(2)
    expectClose(settled!.angle, immediate!.angle, 0.5)
    expectClose(settled!.left, immediate!.left, 0.5)
    expectClose(settled!.top, immediate!.top, 0.5)
  })

  test('corner resize keeps angle and position', async ({ page }) => {
    await addDeviceLayer(page)
    await setRotation(page, 20)
    await waitForCanvasSettled(page)
    const before = await activeObjectState(page)

    await dragControl(page, 'br', 30, 30)
    await waitForCanvasSettled(page)
    const after = await activeObjectState(page)
    expectClose(after!.angle, before!.angle, 0.5)
    expect(after!.scaleX).toBeGreaterThan(before!.scaleX)
  })

  test('dragging a rotated object keeps its angle', async ({ page }) => {
    await addDeviceLayer(page)
    await dragControl(page, 'mtr', 40, 0)
    await waitForCanvasSettled(page)
    const rotated = await activeObjectState(page)

    await dragActiveBody(page, 60, 30)
    await waitForCanvasSettled(page)
    const dragged = await activeObjectState(page)
    expectClose(dragged!.angle, rotated!.angle, 0.3)
    expect(dragged!.left).toBeGreaterThan(rotated!.left + 20)
    expect(dragged!.top).toBeGreaterThan(rotated!.top + 5)
  })

  /**
   * Option en lâchant dépose une copie et laisse l'original.
   *
   * Ce que le test surveille n'est pas « il y a deux calques » mais « l'original
   * n'a pas bougé » : c'est la moitié du geste qui peut se perdre, puisque
   * l'objet réellement tiré porte l'identité de l'original et que rien ne le
   * ramène à sa place sauf la passe de synchronisation. Et un seul pas
   * d'annulation, parce qu'un geste est un pas.
   */
  test('alt-dropping a drag leaves the original and keeps the copy', async ({ page }) => {
    await addTextLayer(page)
    await waitForCanvasSettled(page)
    const before = await screenLayers(page)
    expect(before).toHaveLength(1)
    const history = await historyDepth(page)

    const painted = () => page.evaluate(() => window.__sfCanvas?.getObjects().length ?? 0)
    const paintedBefore = await painted()

    const start = await activeCenter(page)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 90, start.y + 70, { steps: 12 })
    // La touche s'enfonce en cours de geste, et cela suffit.
    await page.keyboard.down('Alt')
    await page.mouse.move(start.x + 92, start.y + 72, { steps: 2 })

    /* Le sosie tient la place de l'original *pendant* le geste : un objet
       peint de plus, et aucun calque de plus. C'est ce qui manquait — on
       voyait l'original quitter sa place, donc rien à quoi mesurer le
       décalage de la copie qu'on est en train de poser. */
    await expect.poll(painted).toBe(paintedBefore + 1)
    expect(await screenLayers(page)).toHaveLength(1)

    await page.mouse.up()
    await page.keyboard.up('Alt')
    await waitForCanvasSettled(page)

    // Et il s'efface au lâcher : la copie est un vrai calque, pas le sosie.
    expect(await painted()).toBe(paintedBefore + 1)

    const after = await screenLayers(page)
    expect(after).toHaveLength(2)
    const original = after.find((layer) => layer.id === before[0].id)
    expect(original).toBeDefined()
    expectClose(original!.x, before[0].x, 1)
    expectClose(original!.y, before[0].y, 1)

    const copy = after.find((layer) => layer.id !== before[0].id)!
    expect(copy.name).toBe(`${before[0].name} copie`)
    expect(copy.x).toBeGreaterThan(before[0].x + 20)
    expect(copy.y).toBeGreaterThan(before[0].y + 20)
    // C'est la copie qu'on tient à la fin du geste, pas l'original.
    expect(await selectedLayerIds(page)).toEqual([copy.id])

    expect(await historyDepth(page)).toBe(history + 1)
    await page.keyboard.press('Meta+z')
    await waitForCanvasSettled(page)
    expect(await screenLayers(page)).toHaveLength(1)
  })

  test('a plain drag still moves the layer instead of copying it', async ({ page }) => {
    await addTextLayer(page)
    await waitForCanvasSettled(page)
    const before = await screenLayers(page)

    await dragActiveBody(page, 90, 70)
    await waitForCanvasSettled(page)

    const after = await screenLayers(page)
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe(before[0].id)
    expect(after[0].x).toBeGreaterThan(before[0].x + 20)
  })

  test('undo restores position after drag', async ({ page }) => {
    await addTextLayer(page)
    const before = await activeObjectState(page)
    await dragActiveBody(page, 80, 40)
    await waitForCanvasSettled(page)
    await page.keyboard.press('Meta+z')
    await waitForCanvasSettled(page)
    const layer = await findObject(page, 'text')
    expectClose(layer!.left!, before!.left, 1.5)
    expectClose(layer!.top!, before!.top, 1.5)
  })

  test('dragging a layer to another screen transfers ownership without reframing', async ({
    page,
  }) => {
    await addTextLayer(page)
    const source = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return { screenId: project?.screens[0]?.id, layerId: project?.screens[0]?.layers[0]?.id }
    })
    expect(source.screenId).toBeTruthy()
    expect(source.layerId).toBeTruthy()

    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await expect
      .poll(() =>
        page.evaluate(() => window.__sfStores?.useProjectStore.getState().project?.activeScreenId),
      )
      .toBe(source.screenId)
    await layerRows(page).first().click()

    const before = await page.evaluate(() => ({
      history: window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
      viewport: [...(window.__sfCanvas?.viewportTransform ?? [])],
      zoom: window.__sfCanvas?.getZoom() ?? -1,
    }))
    const start = await activeCenter(page)
    const destination = await screenCenter(page, 1)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(destination.x, destination.y, { steps: 12 })

    const preview = await page.evaluate((layerId) => {
      const object = window.__sfCanvas
        ?.getObjects()
        .find(
          (candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === layerId,
        )
      return (object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined)
        ?.data
    }, source.layerId)
    expect(preview?.screenIndex).toBe(1)
    expect(preview?.clipScreenIndex).toBe(1)

    await page.mouse.up()
    await waitForCanvasSettled(page)
    const transferred = await page.evaluate((layerId) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const canvas = window.__sfCanvas
      const targetScreen = project?.screens[1]
      const layer = targetScreen?.layers.find((candidate) => candidate.id === layerId)
      const object = canvas
        ?.getObjects()
        .find(
          (candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === layerId,
        )
      const background = canvas
        ?.getObjects()
        .filter(
          (candidate) =>
            (candidate as { data?: { rendererType?: string } }).data?.rendererType === 'background',
        )
        .sort((left, right) => left.left - right.left)[1]
      return {
        sourceCount: project?.screens[0]?.layers.filter((candidate) => candidate.id === layerId)
          .length,
        targetCount: targetScreen?.layers.filter((candidate) => candidate.id === layerId).length,
        activeScreenId: project?.activeScreenId,
        targetScreenId: targetScreen?.id,
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
        storedX: layer?.x,
        renderedX:
          object && background
            ? object.getBoundingRect().left - background.getBoundingRect().left
            : undefined,
        history: window.__sfStores?.useHistoryStore.getState().past.length,
        viewport: [...(canvas?.viewportTransform ?? [])],
        zoom: canvas?.getZoom(),
      }
    }, source.layerId)
    expect(transferred.sourceCount).toBe(0)
    expect(transferred.targetCount).toBe(1)
    expect(transferred.activeScreenId).toBe(transferred.targetScreenId)
    expect(transferred.selectedIds).toEqual([source.layerId])
    expectClose(transferred.renderedX!, transferred.storedX!, 1)
    expect(transferred.history).toBe(before.history + 1)
    expectClose(transferred.zoom!, before.zoom, 0.0001)
    expect(transferred.viewport).toHaveLength(before.viewport.length)
    transferred.viewport.forEach((value, index) =>
      expectClose(value, before.viewport[index], 0.0001),
    )

    await page.keyboard.press('Meta+z')
    await expect
      .poll(() =>
        page.evaluate((layerId) => {
          const project = window.__sfStores?.useProjectStore.getState().project
          return JSON.stringify({
            sourceCount: project?.screens[0]?.layers.filter((candidate) => candidate.id === layerId)
              .length,
            targetCount: project?.screens[1]?.layers.filter((candidate) => candidate.id === layerId)
              .length,
          })
        }, source.layerId),
      )
      .toBe(JSON.stringify({ sourceCount: 1, targetCount: 0 }))
  })

  test('dragging a multi-selection transfers every local layer', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    const layerIds = await page.evaluate(
      () =>
        window.__sfStores?.useProjectStore
          .getState()
          .project?.screens[0]?.layers.map((layer) => layer.id) ?? [],
    )
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await waitForCanvasSettled(page)
    await layerRows(page).first().click()
    await layerRows(page)
      .nth(1)
      .click({ modifiers: ['Meta'] })
    expect((await activeObjectState(page))?.isActiveSelection).toBe(true)

    const start = await activeCenter(page)
    const destination = await screenCenter(page, 1)
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(destination.x, destination.y, { steps: 12 })
    await page.mouse.up()
    await waitForCanvasSettled(page)

    const result = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        sourceIds: project?.screens[0]?.layers.map((layer) => layer.id) ?? [],
        targetIds: project?.screens[1]?.layers.map((layer) => layer.id) ?? [],
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [],
      }
    })
    expect(result.sourceIds).toEqual([])
    expect(new Set(result.targetIds)).toEqual(new Set(layerIds))
    expect(new Set(result.selectedIds)).toEqual(new Set(layerIds))
  })

  test('lasso-selecting another screen’s layers moves nothing', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    await addScreen(page)
    await waitForCanvasSettled(page)

    const before = await sceneCenters(page)
    expect(before.length).toBe(2)

    await lassoOverScreen(page, 0)
    await waitForCanvasSettled(page)

    // Le lasso rend courante la planche qu'il vise, donc relance une passe de
    // synchronisation pendant que la sélection multiple existe. Mesuré avant :
    // les calques repartaient 1182px plus loin, hors de leur écrêtage, donc
    // invisibles — et rien dans le projet ne l'avait demandé.
    expect((await activeObjectState(page))?.isActiveSelection).toBe(true)
    expect(await sceneCenters(page)).toEqual(before)
  })

  test('nudging a multi-selection moves it by exactly one pixel', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    await waitForCanvasSettled(page)
    // Au lasso et non par la liste des calques : la flèche ne nudge que si le
    // focus n'est pas sur un contrôle qui s'en sert lui-même, et une ligne de
    // la liste en est un.
    await lassoOverScreen(page, 0)
    await waitForCanvasSettled(page)
    expect((await activeObjectState(page))?.isActiveSelection).toBe(true)

    const before = await sceneCenters(page)
    await page.keyboard.press('ArrowRight')
    await waitForCanvasSettled(page)

    // Même écriture de géométrie que le lasso, par le chemin `patch` cette
    // fois : une flèche répétée sur une sélection multiple recalait chaque
    // calque sur le centre de la sélection, à chaque appui.
    expect(await sceneCenters(page)).toEqual(
      before.map((center) => ({ ...center, x: center.x + 1 })),
    )
  })

  test('dropping in the gutter keeps the source screen and restores clipping', async ({ page }) => {
    await addTextLayer(page)
    const layerId = await page.evaluate(
      () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.id,
    )
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await waitForCanvasSettled(page)
    await layerRows(page).first().click()

    const [start, firstScreen, secondScreen] = await Promise.all([
      activeCenter(page),
      screenCenter(page, 0),
      screenCenter(page, 1),
    ])
    const gutter = { x: (firstScreen.x + secondScreen.x) / 2, y: firstScreen.y }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(gutter.x, gutter.y, { steps: 12 })
    await page.mouse.up()
    await waitForCanvasSettled(page)

    const afterGutter = await page.evaluate((id) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const object = window.__sfCanvas
        ?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
      const data = (
        object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined
      )?.data
      return {
        sourceCount: project?.screens[0]?.layers.filter((layer) => layer.id === id).length,
        targetCount: project?.screens[1]?.layers.filter((layer) => layer.id === id).length,
        screenIndex: data?.screenIndex,
        clipScreenIndex: data?.clipScreenIndex,
      }
    }, layerId)
    expect(afterGutter).toEqual({
      sourceCount: 1,
      targetCount: 0,
      screenIndex: 0,
      clipScreenIndex: 0,
    })

    const current = await activeCenter(page)
    await page.mouse.move(current.x, current.y)
    await page.mouse.down()
    await page.mouse.move(firstScreen.x, firstScreen.y, { steps: 12 })
    await page.mouse.up()
    await waitForCanvasSettled(page)
    const afterReturn = await page.evaluate((id) => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const object = window.__sfCanvas
        ?.getObjects()
        .find((candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id)
      const data = (
        object as { data?: { screenIndex?: number; clipScreenIndex?: number } } | undefined
      )?.data
      return {
        sourceCount: project?.screens[0]?.layers.filter((layer) => layer.id === id).length,
        targetCount: project?.screens[1]?.layers.filter((layer) => layer.id === id).length,
        screenIndex: data?.screenIndex,
        clipScreenIndex: data?.clipScreenIndex,
      }
    }, layerId)
    expect(afterReturn).toEqual({
      sourceCount: 1,
      targetCount: 0,
      screenIndex: 0,
      clipScreenIndex: 0,
    })
  })

  /**
   * Ce qu'un calque sorti de sa planche promet, et ce qu'il ne promet plus.
   *
   * Le défaut mesuré avant le fantôme : hors de sa planche, un calque devenait
   * invisible partout et restait pourtant cliquable **au-dessus de la planche
   * voisine**, où il volait le clic destiné au calque de celle-ci. Retirer la
   * prise ferme ce défaut. Le panneau garde un retour explicite et la scène
   * vide rend le fantôme saisissable le temps du seul geste de récupération.
   */
  test('a layer pushed off its board loses the grab and offers the way back', async ({ page }) => {
    await addTextLayer(page)
    const layerId = await page.evaluate(
      () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.id,
    )
    expect(layerId).toBeTruthy()

    const grab = async () =>
      page.evaluate((id) => {
        const object = window.__sfCanvas
          ?.getObjects()
          .find((candidate) => (candidate as DebugObject).data?.layerId === id)
        return { selectable: object?.selectable, evented: object?.evented }
      }, layerId)

    expect(await grab()).toEqual({ selectable: true, evented: true })

    const positionX = transformInput(page, 0)
    await fillNumber(positionX, '-600')
    await positionX.press('Enter')
    await waitForCanvasSettled(page)

    // Les deux drapeaux : `evented` porte le clic, `selectable` porte le lasso.
    expect(await grab()).toEqual({ selectable: false, evented: false })
    // Rien n'est supprimé pour autant — le calque est toujours dans l'écran.
    expect((await screenLayers(page)).map((layer) => layer.id)).toEqual([layerId])

    const bringBack = page.getByRole('button', { name: 'Ramener sur la planche' })
    await expect(bringBack).toBeVisible()
    await bringBack.click()
    await waitForCanvasSettled(page)

    expect((await screenLayers(page))[0].x).toBe(0)
    expect(await grab()).toEqual({ selectable: true, evented: true })
    await expect(bringBack).toBeHidden()
  })

  test('a lost layer can be dragged back from the empty stage', async ({ page }) => {
    await addTextLayer(page)
    const positionX = transformInput(page, 0)
    await fillNumber(positionX, '-600')
    await positionX.press('Enter')
    await waitForCanvasSettled(page)

    const [ghost, board] = await Promise.all([activeCenter(page), screenCenter(page, 0)])
    await page.mouse.move(ghost.x, ghost.y)
    await page.mouse.down()
    await page.mouse.move(board.x, board.y, { steps: 12 })
    await page.mouse.up()
    await waitForCanvasSettled(page)

    const [layer] = await screenLayers(page)
    expect(layer.x).toBeGreaterThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Ramener sur la planche' })).toBeHidden()
  })

  test('repeated transfers stay stable through undo and redo', async ({ page }) => {
    await addTextLayer(page)
    const layerId = await page.evaluate(
      () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.id,
    )
    expect(layerId).toBeTruthy()

    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await waitForCanvasSettled(page)
    await page.locator(`[data-layer-id="${layerId}"]`).click()
    const viewport = await page.evaluate(() => ({
      transform: [...(window.__sfCanvas?.viewportTransform ?? [])],
      zoom: window.__sfCanvas?.getZoom() ?? -1,
    }))

    async function expectStableOwner(ownerIndex: number) {
      const state = await page.evaluate(
        ({ id, index }) => {
          const project = window.__sfStores?.useProjectStore.getState().project
          const canvas = window.__sfCanvas
          const owner = project?.screens[index]
          const layer = owner?.layers.find((candidate) => candidate.id === id)
          const object = canvas
            ?.getObjects()
            .find(
              (candidate) => (candidate as { data?: { layerId?: string } }).data?.layerId === id,
            )
          const background = canvas
            ?.getObjects()
            .filter(
              (candidate) =>
                (candidate as { data?: { rendererType?: string } }).data?.rendererType ===
                'background',
            )
            .sort((left, right) => left.left - right.left)[index]
          return {
            counts: project?.screens.map(
              (screen) => screen.layers.filter((candidate) => candidate.id === id).length,
            ),
            activeScreenId: project?.activeScreenId,
            ownerScreenId: owner?.id,
            selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
            storedX: layer?.x,
            storedY: layer?.y,
            renderedX:
              object && background
                ? object.getBoundingRect().left - background.getBoundingRect().left
                : undefined,
            renderedY:
              object && background
                ? object.getBoundingRect().top - background.getBoundingRect().top
                : undefined,
            viewport: [...(canvas?.viewportTransform ?? [])],
            zoom: canvas?.getZoom() ?? -1,
          }
        },
        { id: layerId!, index: ownerIndex },
      )
      expect(state.counts).toEqual(ownerIndex === 0 ? [1, 0] : [0, 1])
      expect(state.activeScreenId).toBe(state.ownerScreenId)
      expect(state.selectedIds).toEqual([layerId])
      expectClose(state.renderedX!, state.storedX!, 1)
      expectClose(state.renderedY!, state.storedY!, 1)
      expectClose(state.zoom, viewport.zoom, 0.0001)
      expect(state.viewport).toHaveLength(viewport.transform.length)
      state.viewport.forEach((value, index) =>
        expectClose(value, viewport.transform[index], 0.0001),
      )
    }

    await dragSelectionToScreen(page, 1)
    await expectStableOwner(1)
    await dragSelectionToScreen(page, 0)
    await expectStableOwner(0)

    await page.keyboard.press('Meta+z')
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.__sfStores?.useProjectStore
              .getState()
              .project?.screens.map(
                (screen) => screen.layers.filter((layer) => layer.id === id).length,
              ),
          layerId,
        ),
      )
      .toEqual([0, 1])

    await page.keyboard.press('Meta+Shift+z')
    await expect
      .poll(() =>
        page.evaluate(
          (id) =>
            window.__sfStores?.useProjectStore
              .getState()
              .project?.screens.map(
                (screen) => screen.layers.filter((layer) => layer.id === id).length,
              ),
          layerId,
        ),
      )
      .toEqual([1, 0])
  })

  test('mixed local and shared selection transfers only the local layer', async ({ page }) => {
    await addDeviceLayer(page)
    await addScreen(page)
    await page.locator('button[aria-label^="Activer"]').first().click()
    await waitForCanvasSettled(page)
    await layerRows(page).first().click()
    await page.locator('button', { hasText: 'Partager partout' }).click()
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__sfStores?.useProjectStore.getState().project?.layoutLayers.length ?? 0,
        ),
      )
      .toBe(1)
    await addTextLayer(page)

    const ids = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project as
        { screens: { layers: { id: string }[] }[]; layoutLayers: { id: string }[] } | undefined
      return {
        local: project?.screens[0]?.layers[0]?.id,
        shared: project?.layoutLayers[0]?.id,
      }
    })
    expect(ids.local).toBeTruthy()
    expect(ids.shared).toBeTruthy()
    await page.locator(`[data-layer-id="${ids.local}"]`).click()
    await page.locator(`[data-layer-id="${ids.shared}"]`).click({ modifiers: ['Meta'] })
    expect((await activeObjectState(page))?.isActiveSelection).toBe(true)

    await dragSelectionToScreen(page, 1)
    const result = await page.evaluate(
      ({ localId, sharedId }) => {
        const project = window.__sfStores?.useProjectStore.getState().project as
          | {
              screens: { layers: { id: string }[] }[]
              layoutLayers: { id: string; scope?: string }[]
            }
          | undefined
        return {
          localCounts: project?.screens.map(
            (screen) => screen.layers.filter((layer) => layer.id === localId).length,
          ),
          sharedLocalCounts: project?.screens.map(
            (screen) => screen.layers.filter((layer) => layer.id === sharedId).length,
          ),
          sharedLayoutCount: project?.layoutLayers.filter(
            (layer) => layer.id === sharedId && layer.scope === 'layout',
          ).length,
          selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
        }
      },
      { localId: ids.local!, sharedId: ids.shared! },
    )
    expect(result.localCounts).toEqual([0, 1])
    expect(result.sharedLocalCounts).toEqual([0, 0])
    expect(result.sharedLayoutCount).toBe(1)
    expect(new Set(result.selectedIds)).toEqual(new Set([ids.local, ids.shared]))
  })
})
