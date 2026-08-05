import { test, expect } from '@playwright/test'
import {
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  layerRows,
  waitForApp,
} from './helpers'
import { FILMSTRIP_PADDING, THUMBNAIL_SLOT, THUMBNAIL_WIDTH } from '../src/lib/stage'

test.describe('smoke', () => {
  test('app loads and project name is editable', async ({ page }) => {
    await waitForApp(page)
    const nameInput = page.locator('input[aria-label="Nom du projet"]')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('Mon app')
    await nameInput.press('Enter')
    await expect(nameInput).toHaveValue('Mon app')
  })

  test('all layer types can be added and undone', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addShapeLayer(page)
    await addDeviceLayer(page)
    await expect(layerRows(page)).toHaveCount(3)

    await page.keyboard.press('Meta+z')
    await expect(layerRows(page)).toHaveCount(2)
    await page.keyboard.press('Meta+Shift+z')
    await expect(layerRows(page)).toHaveCount(3)
  })

  test('screens can be added, duplicated and deleted', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addScreen(page)
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(2)

    // Duplicate screen 1 via its context menu.
    await page.locator('button[aria-label^="Activer"]').first().click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Dupliquer' }).click()
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(3)

    // Delete the duplicate.
    await page.locator('button[aria-label^="Activer"]').nth(1).click({ button: 'right' })
    await page.locator('[data-context-menu] [role="menuitem"]', { hasText: 'Supprimer' }).click()
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(2)
  })

  test('dragging a screen previews the new order and keeps it on drop', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)
    await addScreen(page)
    const names = () => page.evaluate(() =>
      window.__sfStores?.useProjectStore.getState().project?.screens.map((screen) => screen.name))
    const before = await names()

    // Le décalage libère l'emplacement sous le curseur : au lâcher, celui-ci
    // survole le vide, donc la bande — et non une tuile. C'est ce que ce test
    // garde, le lâcher n'étant sinon accepté nulle part et l'ordre revenant à
    // son état initial après l'animation.
    const fire = (target: 'strip' | number, type: string) =>
      page.evaluate(([node, event]) => {
        const strip = document.querySelector('[role="group"][aria-label="Écrans"]')
        if (!strip) throw new Error('bande introuvable')
        const scope = window as unknown as { __sfDrag?: DataTransfer }
        scope.__sfDrag ??= new DataTransfer()
        const tiles = [...strip.querySelectorAll<HTMLElement>(':scope > div[draggable]')]
        const receiver = node === 'strip' ? strip : tiles[node as number]
        receiver.dispatchEvent(
          new DragEvent(event as string, { bubbles: true, dataTransfer: scope.__sfDrag }),
        )
      }, [target, type] as const)

    const shifts = () => page.evaluate(() =>
      [...document.querySelectorAll('[role="group"][aria-label="Écrans"] > div[draggable]')]
        .map((tile) => getComputedStyle(tile).translate))

    /** La barre d'insertion : sa distance au bord de la bande, ou `null`. */
    const insertionBar = () => page.evaluate(() => {
      const strip = document.querySelector('[role="group"][aria-label="Écrans"]')
      const bar = strip?.querySelector<HTMLElement>(':scope > span[aria-hidden]')
      if (!strip || !bar) return null
      return {
        offset: Math.round(bar.getBoundingClientRect().left - strip.getBoundingClientRect().left),
        // Inerte au pointeur, sinon elle vole le `dragover` qui décide de la
        // cible : elle est posée exactement là où le curseur se trouve.
        inert: getComputedStyle(bar).pointerEvents === 'none',
      }
    })

    expect(await insertionBar()).toBeNull()

    await fire(0, 'dragstart')
    await fire(2, 'dragover')
    // La tuile déplacée reste en place, les deux survolées reculent d'un pas.
    await expect.poll(shifts).toEqual(['0px', expect.not.stringMatching(/^0px$/), expect.anything()])
    const previewed = await shifts()
    expect(previewed[1]).toBe(previewed[2])

    // La barre marque l'emplacement visé : le troisième rang, dans le vide que
    // la rangée vient d'ouvrir.
    const expected = FILMSTRIP_PADDING + 2 * THUMBNAIL_SLOT + THUMBNAIL_WIDTH / 2 - 1.5
    await expect.poll(insertionBar).toEqual({ offset: Math.round(expected), inert: true })

    await fire('strip', 'drop')
    await fire(0, 'dragend')
    await expect.poll(names).toEqual([before![1], before![2], before![0]])
    await expect.poll(shifts).toEqual(['0px', '0px', '0px'])
    await expect.poll(insertionBar).toBeNull()

    // Le retour en arrière passe par la même mécanique, dans l'autre sens.
    await fire(2, 'dragstart')
    await fire(0, 'dragover')
    await fire('strip', 'drop')
    await fire(2, 'dragend')
    await expect.poll(names).toEqual(before)
  })

  test('screen settings can be copied, pasted and undone without replacing layers', async ({ page }) => {
    await waitForApp(page)
    await addTextLayer(page)
    await addScreen(page)
    await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      const sourceId = project?.screens[0]?.id
      if (!sourceId) throw new Error('source screen missing')
      window.__sfStores?.useProjectStore.getState().updateScreenBackground(sourceId, {
        type: 'linear-gradient',
        angle: 270,
        stops: [
          { offset: 0, color: '#101010' },
          { offset: 1, color: '#f0f0f0' },
        ],
      })
    })

    const screens = page.locator('button[aria-label^="Activer"]')
    await screens.first().click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Copier les réglages' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Réglages de Écran 1 copiés' })).toBeVisible()

    await screens.nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Coller les réglages' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Réglages appliqués à Écran 2' })).toBeVisible()

    const pasted = await page.evaluate(() => {
      const project = window.__sfStores?.useProjectStore.getState().project
      return {
        source: project?.screens[0]?.background,
        target: project?.screens[1]?.background,
        sourceLayerCount: project?.screens[0]?.layers.length,
        targetLayerCount: project?.screens[1]?.layers.length,
      }
    })
    expect(pasted.target).toEqual(pasted.source)
    expect(pasted).toMatchObject({ sourceLayerCount: 1, targetLayerCount: 0 })

    await page.keyboard.press('Meta+z')
    await expect.poll(async () => page.evaluate(() =>
      window.__sfStores?.useProjectStore.getState().project?.screens[1]?.background.type,
    )).toBe('solid')
  })

  test('background gestures keep independent undo steps', async ({ page }) => {
    await waitForApp(page)
    await page.getByRole('group', { name: 'Type d’arrière-plan' })
      .getByRole('button', { name: 'Dégradé' })
      .click()

    const angle = page.getByRole('slider', { name: 'Angle du dégradé' })
    await angle.focus()
    await angle.press('ArrowRight')
    await angle.press('ArrowRight')
    await expect(angle).toHaveAttribute('aria-valuenow', '137')
    await expect.poll(() => page.evaluate(() =>
      window.__sfStores?.useHistoryStore.getState().past.length,
    )).toBe(2)

    await page.keyboard.press('Meta+z')
    await expect(angle).toHaveAttribute('aria-valuenow', '135')
    await page.keyboard.press('Meta+z')
    await expect(page.getByRole('group', { name: 'Type d’arrière-plan' })
      .getByRole('button', { name: 'Uni' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('export dialog opens with App Store dimensions', async ({ page }) => {
    await waitForApp(page)
    await page.locator('button[aria-label="Ouvrir l’export"]').click()
    await expect(page.locator('text=1320').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})
