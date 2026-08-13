import { expect, test } from '@playwright/test'
import { addTextLayer, layerRows, waitForApp } from './helpers'

test.describe('command palette', () => {
  test('le déclencheur de la TopBar garde la primitive et rend le focus', async ({ page }) => {
    await waitForApp(page)
    const trigger = page.getByRole('button', { name: 'Ouvrir la palette de commandes' })
    await expect(trigger).toHaveAttribute('data-slot', 'icon-button')
    /* L'infobulle est la primitive, pas le `title=` natif : elle se montre au
       survol comme au focus clavier. */
    await trigger.hover()
    await expect(page.getByRole('tooltip')).toContainText('Palette de commandes')
    await expect.poll(async () => Math.round((await trigger.boundingBox())?.width ?? 0)).toBe(36)
    await expect.poll(async () => Math.round((await trigger.boundingBox())?.height ?? 0)).toBe(36)

    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Palette de commandes' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  })

  test('opens with ⌘K, filters and runs a command', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+k')
    const dialog = page.getByRole('dialog', { name: 'Palette de commandes' })
    await expect(dialog).toBeVisible()

    await page.keyboard.type('texte')
    const option = dialog.getByRole('option', { name: 'Ajouter un texte' })
    await expect(option).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(layerRows(page)).toHaveCount(1)
    // La ligne porte le contenu du calque, pas son type : un calque de texte
    // jamais renommé s'annonce par ce qu'il dit.
    await expect(layerRows(page).first()).toContainText('Titre accrocheur')
  })

  test('Escape closes the palette', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+k')
    const dialog = page.getByRole('dialog', { name: 'Palette de commandes' })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('⌘⇧K n’ouvre pas la palette', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('Meta+Shift+k')
    await expect(page.getByRole('dialog', { name: 'Palette de commandes' })).toHaveCount(0)
  })

  /* Chaque raccourci affiché par la palette doit être câblé : une annonce sans
     geste est pire qu'une absence, elle apprend un réflexe qui ne marche pas. */
  test('les raccourcis annoncés par la palette déclenchent leur action', async ({ page }) => {
    await waitForApp(page)

    await page.keyboard.press('t')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__sfStores?.useProjectStore
              .getState()
              .project?.screens.flatMap((screen) => screen.layers)
              .filter((layer) => layer.type === 'text').length ?? 0,
        ),
      )
      .toBe(1)

    await page.keyboard.press('r')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__sfStores?.useProjectStore
              .getState()
              .project?.screens.flatMap((screen) => screen.layers)
              .filter((layer) => layer.type === 'shape').length ?? 0,
        ),
      )
      .toBe(1)

    await page.keyboard.press('Meta+e')
    await expect(page.getByRole('dialog', { name: 'Export officiel' })).toBeVisible()
    await page.keyboard.press('Escape')
  })
})

test.describe('history coalescing', () => {
  test('a burst of arrow nudges is a single undo step', async ({ page }) => {
    await page.clock.install()
    await waitForApp(page)
    await addTextLayer(page)

    const pastBefore = await page.evaluate(
      () => window.__sfStores?.useHistoryStore.getState().past.length ?? -1,
    )
    const xBefore = await page.evaluate(
      () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.x ?? -1,
    )
    expect(xBefore).toBeGreaterThanOrEqual(0)

    // Burst: 5 nudges well inside the 1200ms coalesce window.
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight')
    await expect
      .poll(() =>
        page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? -1),
      )
      .toBe(pastBefore + 1)

    // After the window expires, the next nudge starts a new entry.
    await page.clock.fastForward(1_400)
    await page.keyboard.press('ArrowRight')
    await expect
      .poll(() =>
        page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? -1),
      )
      .toBe(pastBefore + 2)

    // Undo the last single nudge, then ONE undo reverts the whole burst.
    await page.keyboard.press('Meta+z')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.x ?? -1,
        ),
      )
      .toBe(xBefore + 5)
    await page.keyboard.press('Meta+z')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__sfStores?.useProjectStore.getState().project?.screens[0]?.layers[0]?.x ?? -1,
        ),
      )
      .toBe(xBefore)
  })
})
