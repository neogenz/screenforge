import { test, expect } from '@playwright/test'
import {
  activeCenter,
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  findObject,
  layerRows,
  waitForApp,
  waitForCanvasSettled,
} from './helpers'

test.describe('layers panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('context menu duplicates and deletes a layer', async ({ page }) => {
    await addTextLayer(page)
    await expect(layerRows(page)).toHaveCount(1)
    const originalId = await layerRows(page).first().getAttribute('data-layer-id')

    // Duplicate via right-click menu.
    await layerRows(page).first().click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Dupliquer' }).click()
    await expect(layerRows(page)).toHaveCount(2)
    await expect(layerRows(page).filter({ hasText: 'copie' })).toHaveCount(1)
    const duplicated = await page.evaluate(() => {
      const canvas = window.__sfStores?.useCanvasStore.getState()
      const project = window.__sfStores?.useProjectStore.getState().project
      const layers =
        project?.screens.find((screen) => screen.id === project.activeScreenId)?.layers ?? []
      return {
        copyId: layers.find((layer) => layer.id !== layers[0]?.id)?.id,
        selectedIds: canvas?.selectedLayerIds ?? [],
      }
    })
    expect(duplicated.copyId).toBeTruthy()
    expect(duplicated.copyId).not.toBe(originalId)
    expect(duplicated.selectedIds).toEqual([duplicated.copyId])

    // Delete the copy via right-click menu.
    await layerRows(page).filter({ hasText: 'copie' }).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(layerRows(page)).toHaveCount(1)
    expect(
      await page.evaluate(
        () => window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [],
      ),
    ).toEqual([])
  })

  test('cmd-click toggles multi-selection, menu acts on all selected', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    await expect(layerRows(page)).toHaveCount(2)

    await layerRows(page).nth(0).click()
    await layerRows(page)
      .nth(1)
      .click({ modifiers: ['Meta'] })
    await expect(page.locator('[data-layer-id][aria-selected="true"]')).toHaveCount(2)

    await layerRows(page).nth(1).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(layerRows(page)).toHaveCount(0)
    expect(
      await page.evaluate(
        () => window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [],
      ),
    ).toEqual([])
  })

  test('double-click renames a layer', async ({ page }) => {
    await addTextLayer(page)
    await layerRows(page).first().dblclick()
    const input = page.locator('[data-layer-id] input')
    await input.fill('Titre principal')
    await input.press('Enter')
    await expect(layerRows(page).first()).toContainText('Titre principal')
  })

  test('visibility toggle hides the layer on canvas', async ({ page }) => {
    await addDeviceLayer(page)
    const row = layerRows(page).first()
    await row.hover()
    await row.locator('button[aria-label="Masquer le calque"]').click()
    await expect.poll(async () => (await findObject(page, 'device-frame'))?.visible).toBe(false)
  })

  test('device model menu uses its button as trigger and restores focus', async ({ page }) => {
    await addDeviceLayer(page)
    const trigger = page.getByRole('button', { name: /iPhone 17 Pro Max/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    // Base UI nomme le menu par son déclencheur, comme le veut le motif ARIA.
    await expect(page.getByRole('menu', { name: /iPhone 17 Pro Max/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu', { name: /iPhone 17 Pro Max/ })).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('Meta+C and Meta+V copy every selected layer with new ids', async ({ page }) => {
    await addTextLayer(page)
    await addShapeLayer(page)
    await layerRows(page).first().click()
    await layerRows(page)
      .nth(1)
      .click({ modifiers: ['Meta'] })
    const originalIds = await page.evaluate(
      () =>
        window.__sfStores?.useProjectStore
          .getState()
          .project?.screens[0]?.layers.map((layer) => layer.id) ?? [],
    )

    await page.keyboard.press('Meta+c')
    await page.keyboard.press('Meta+v')
    await expect
      .poll(() =>
        page.evaluate(
          () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers.length,
        ),
      )
      .toBe(4)

    const state = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        layerIds: project?.screens[0]?.layers.map((layer) => layer.id) ?? [],
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds ?? [],
      }
    })
    expect(state.layerIds).toHaveLength(4)
    expect(state.selectedIds).toHaveLength(2)
    expect(state.selectedIds.every((id) => !originalIds.includes(id))).toBe(true)
    expect(state.layerIds).toEqual(expect.arrayContaining([...originalIds, ...state.selectedIds]))
  })

  test('Control+X is undoable and Control+V pastes on the active screen', async ({ page }) => {
    await addTextLayer(page)
    const original = await page.evaluate(() => {
      const layer = window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]
      return { id: layer?.id, x: layer?.x, y: layer?.y }
    })
    const historyBefore = await page.evaluate(
      () => window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
    )

    await page.keyboard.press('Control+x')
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.stringify({
            count: window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers.length,
            selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
            history: window.__sfStores?.useHistoryStore.getState().past.length,
          }),
        ),
      )
      .toBe(JSON.stringify({ count: 0, selectedIds: [], history: historyBefore + 1 }))

    await page.keyboard.press('Meta+z')
    await expect(layerRows(page)).toHaveCount(1)
    await layerRows(page).first().click()
    await page.keyboard.press('Control+x')
    await addScreen(page)
    await page.keyboard.press('Control+v')
    await waitForCanvasSettled(page)

    const pasted = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const layer = project?.screens[1]?.layers[0]
      return {
        sourceCount: project?.screens[0]?.layers.length,
        targetCount: project?.screens[1]?.layers.length,
        activeScreenId: project?.activeScreenId,
        targetScreenId: project?.screens[1]?.id,
        layer,
        selectedIds: window.__sfStores?.useCanvasStore.getState().selectedLayerIds,
      }
    })
    expect(pasted.sourceCount).toBe(0)
    expect(pasted.targetCount).toBe(1)
    expect(pasted.activeScreenId).toBe(pasted.targetScreenId)
    expect(pasted.layer?.id).not.toBe(original.id)
    expect(pasted.layer?.x).toBe(original.x! + 20)
    expect(pasted.layer?.y).toBe(original.y! + 20)
    expect(pasted.selectedIds).toEqual([pasted.layer?.id])
  })

  test('layer shortcuts stay native while editing Fabric text', async ({ page }) => {
    await addTextLayer(page)
    const center = await activeCenter(page)
    await page.mouse.dblclick(center.x, center.y)
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            (window.__sfCanvas?.getActiveObject() as { isEditing?: boolean } | undefined)
              ?.isEditing,
          ),
        ),
      )
      .toBe(true)
    await page.keyboard.press('Meta+a')
    await page.keyboard.type('Texte natif')
    await page.keyboard.press('Meta+a')
    await page.keyboard.press('Meta+x')
    await page.keyboard.press('Meta+v')
    await page.keyboard.press('Escape')

    await expect(layerRows(page)).toHaveCount(1)
    await expect.poll(async () => (await findObject(page, 'text'))?.text).toBe('Texte natif')
  })

  test('shortcuts help lists copy, cut and paste', async ({ page }) => {
    const returnTarget = page.getByRole('button', { name: 'Ouvrir les modèles' })
    await returnTarget.focus()
    await page.keyboard.press('?')
    const dialog = page.getByRole('dialog', { name: 'Raccourcis clavier' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Copier / couper / coller')).toBeVisible()
    await expect(dialog.getByText('⌘C / ⌘X / ⌘V')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(returnTarget).toBeFocused()
  })
})
