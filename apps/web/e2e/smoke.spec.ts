import { test, expect, type Page } from '@playwright/test'
import {
  addDeviceLayer,
  addScreen,
  addShapeLayer,
  addTextLayer,
  layerRows,
  waitForApp,
} from './helpers'
import {
  FILMSTRIP_PADDING,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_SLOT,
  THUMBNAIL_WIDTH,
} from '../src/lib/stage'
import { makeSolidPng } from './device-bezel-fixture'

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
    await page.getByRole('alertdialog').getByRole('button', { name: 'Supprimer l’écran' }).click()
    await expect(page.locator('button[aria-label^="Activer"]')).toHaveCount(2)
  })

  test('dragging a screen previews the new order and keeps it on drop', async ({ page }) => {
    await waitForApp(page)
    await addScreen(page)
    await addScreen(page)
    const names = () =>
      page.evaluate(() =>
        window.__sfStores?.useProjectStore.getState().project?.screens.map((screen) => screen.name),
      )
    const before = await names()

    const strip = '[role="group"][aria-label="Écrans"]'

    /** Un `dragstart` ou un `dragend` sur une tuile, qui les porte. */
    const fireOnTile = (index: number, type: string) =>
      page.evaluate(
        ([node, event]) => {
          const tiles = [
            ...document.querySelectorAll<HTMLElement>(
              '[role="group"][aria-label="Écrans"] > div[draggable]',
            ),
          ]
          const scope = window as unknown as { __sfDrag?: DataTransfer }
          scope.__sfDrag ??= new DataTransfer()
          tiles[node as number].dispatchEvent(
            new DragEvent(event as string, { bubbles: true, dataTransfer: scope.__sfDrag }),
          )
        },
        [index, type] as const,
      )

    /**
     * Un `dragover` ou un `drop` sur la bande, au centre d'un emplacement.
     *
     * La cible se lit désormais sur l'abscisse du curseur et non sur la tuile
     * survolée : le voisin décalé recouvre l'emplacement d'origine, et le
     * désigner rendait le rang de départ — donc le rang 0 pour une tuile prise
     * en tête — injoignable pendant tout le geste.
     */
    const fireOnStrip = (slot: number, type: string) =>
      page.evaluate(
        ([index, event, padding, slotWidth, width, height]) => {
          const box = document.querySelector('[role="group"][aria-label="Écrans"]')
          if (!box) throw new Error('bande introuvable')
          const scope = window as unknown as { __sfDrag?: DataTransfer }
          scope.__sfDrag ??= new DataTransfer()
          const bounds = box.getBoundingClientRect()
          const clientX =
            bounds.left -
            box.scrollLeft +
            (padding as number) +
            (index as number) * (slotWidth as number) +
            (width as number) / 2
          const clientY = bounds.top + (padding as number) + (height as number) / 2
          // L'élément que le navigateur désigne à ce point, et non la bande : le
          // voisin décalé passe *au-dessus* de la tuile déplacée, et c'est
          // précisément ce recouvrement qui rendait le rang de départ injoignable.
          // Viser la bande directement masquerait le défaut au lieu de le tester.
          const target = document.elementFromPoint(clientX, clientY) ?? box
          target.dispatchEvent(
            new DragEvent(event as string, {
              bubbles: true,
              clientX,
              clientY,
              dataTransfer: scope.__sfDrag,
            }),
          )
        },
        [slot, type, FILMSTRIP_PADDING, THUMBNAIL_SLOT, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT] as const,
      )

    const shifts = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[role="group"][aria-label="Écrans"] > div[draggable]')].map(
          (tile) => getComputedStyle(tile).translate,
        ),
      )

    /** La barre d'insertion : sa distance au bord de la bande, ou `null`. */
    const insertionBar = () =>
      page.evaluate((selector) => {
        const box = document.querySelector(selector)
        const bar = box?.querySelector<HTMLElement>(':scope > span[aria-hidden]')
        if (!box || !bar) return null
        return {
          offset: Math.round(bar.getBoundingClientRect().left - box.getBoundingClientRect().left),
          // Inerte au pointeur, sinon elle vole le `dragover` qui décide de la
          // cible : elle est posée exactement là où le curseur se trouve.
          inert: getComputedStyle(bar).pointerEvents === 'none',
        }
      }, strip)

    const barAtSlot = (slot: number) =>
      Math.round(FILMSTRIP_PADDING + slot * THUMBNAIL_SLOT + THUMBNAIL_WIDTH / 2 - 1.5)

    expect(await insertionBar()).toBeNull()

    await fireOnTile(0, 'dragstart')
    await fireOnStrip(2, 'dragover')
    // La tuile déplacée reste en place, les deux survolées reculent d'un pas.
    await expect
      .poll(shifts)
      .toEqual(['0px', expect.not.stringMatching(/^0px$/), expect.anything()])
    const previewed = await shifts()
    expect(previewed[1]).toBe(previewed[2])
    await expect.poll(insertionBar).toEqual({ offset: barAtSlot(2), inert: true })

    // Le retour à l'emplacement de départ, celui que la voisine décalée
    // recouvre. Il était injoignable, et c'est ce qui bloquait le rang 0.
    await fireOnStrip(0, 'dragover')
    await expect.poll(insertionBar).toEqual({ offset: barAtSlot(0), inert: true })
    await expect.poll(shifts).toEqual(['0px', '0px', '0px'])

    await fireOnStrip(2, 'dragover')
    await fireOnStrip(2, 'drop')
    await fireOnTile(0, 'dragend')
    await expect.poll(names).toEqual([before![1], before![2], before![0]])
    await expect.poll(shifts).toEqual(['0px', '0px', '0px'])
    await expect.poll(insertionBar).toBeNull()

    // Le retour en arrière passe par la même mécanique, dans l'autre sens.
    await fireOnTile(2, 'dragstart')
    await fireOnStrip(0, 'dragover')
    await fireOnStrip(0, 'drop')
    await fireOnTile(2, 'dragend')
    await expect.poll(names).toEqual(before)
  })

  test('screen settings can be copied, pasted and undone without replacing layers', async ({
    page,
  }) => {
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
    await expect(
      page.getByRole('status').filter({ hasText: 'Réglages de Écran 1 copiés' }),
    ).toBeVisible()

    await screens.nth(1).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Coller les réglages' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Réglages appliqués à Écran 2' }),
    ).toBeVisible()

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
    await expect
      .poll(async () =>
        page.evaluate(
          () => window.__sfStores?.useProjectStore.getState().project?.screens[1]?.background.type,
        ),
      )
      .toBe('solid')
  })

  test('background gestures keep independent undo steps', async ({ page }) => {
    await waitForApp(page)
    await page
      .getByRole('group', { name: 'Type d’arrière-plan' })
      .getByRole('button', { name: 'Dégradé' })
      .click()

    const angle = page.getByRole('slider', { name: 'Angle du dégradé' })
    await angle.focus()
    await angle.press('ArrowRight')
    await angle.press('ArrowRight')
    await expect(angle).toHaveAttribute('aria-valuenow', '137')
    await expect
      .poll(() => page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length))
      .toBe(2)

    await page.keyboard.press('Meta+z')
    await expect(angle).toHaveAttribute('aria-valuenow', '135')
    await page.keyboard.press('Meta+z')
    await expect(
      page.getByRole('group', { name: 'Type d’arrière-plan' }).getByRole('button', { name: 'Uni' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * Le premier geste de la cible : ses captures, pas un cadre vide.
   *
   * Le parcours entier, du projet neuf aux planches composées, sans passer par
   * la barre haute : l'écran vide ouvre le sélecteur, la boîte s'ouvre déjà
   * remplie, et rien n'est écrit au projet avant « Ajouter ».
   */
  test('l’écran vide part des captures et compose la campagne', async ({ page }) => {
    await waitForApp(page)
    const before = await screenCount(page)

    await page
      .locator('aside input[type="file"]')
      .setInputFiles([1, 2, 3].map((rank) => capture(`Écran ${String(rank)}`, rank)))

    const dialog = page.getByRole('dialog', { name: 'Générer les visuels App Store' })
    await expect(dialog).toBeVisible()
    // Les trois captures sont déjà là, et le nombre de visuels les suit.
    await expect(page.getByRole('button', { name: '3 captures' })).toBeVisible()
    await expect(page.getByLabel('Combien de visuels')).toHaveText(/Visuels\s*3$/)

    await page.getByLabel('Nom de l’app').fill('Cadence')
    await page.getByRole('button', { name: 'Proposer 3 visuels' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifiez la proposition' })).toBeVisible()
    // Rien n'est encore au projet : le plan est libre jusqu'au dernier clic.
    expect(await screenCount(page)).toBe(before)

    await page.getByRole('button', { name: 'Ajouter 3 visuels' }).click()
    await expect(dialog).toBeHidden()

    // Trois planches de plus, chacune portant sa capture sur son appareil.
    expect(await screenCount(page)).toBe(before + 3)
    expect(await capturedDevices(page)).toBe(3)

    // Et le lot entier vaut un seul pas d'annulation.
    await page.keyboard.press('Meta+z')
    await expect.poll(() => screenCount(page)).toBe(before)
  })

  /**
   * Le même dépôt, mais lâché sur la scène.
   *
   * Ce que ça doit prouver tient en deux choses : l'onglet ne navigue jamais
   * vers le PNG, et un fichier qui n'est pas une capture ne déclenche rien.
   */
  test('déposer des captures sur la scène ouvre la même boîte, un .txt non', async ({ page }) => {
    await waitForApp(page)
    const stage = page.locator('.stage-grain')
    const png = (rank: number) => [...makeSolidPng(300, 600, [34 + rank * 60, 197, 94, 255])]
    const dialog = page.getByRole('dialog', { name: 'Générer les visuels App Store' })

    await dropFiles(page, [{ name: 'notes.txt', type: 'text/plain', bytes: [110, 111] }])
    await expect(dialog).toBeHidden()

    await dropFiles(page, [
      { name: 'Accueil.png', type: 'image/png', bytes: png(1) },
      { name: 'Réglages.png', type: 'image/png', bytes: png(2) },
    ])
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('button', { name: '2 captures' })).toBeVisible()
    await expect(stage).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/')
  })

  test('export dialog opens with App Store dimensions', async ({ page }) => {
    await waitForApp(page)
    await page.locator('button[aria-label="Ouvrir l’export"]').click()
    await expect(page.locator('text=1320').first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
  })
})

/**
 * Une capture de simulateur plausible : une couleur pleine, un nom de fichier.
 *
 * La teinte suit le rang, et ce n'est pas décoratif : le registre d'assets
 * déduplique par empreinte, donc deux captures identiques n'en feraient qu'une
 * — un lot de trois écrans distincts ne serait plus prouvé.
 */
function capture(name: string, rank: number) {
  return {
    name: `${name}.png`,
    mimeType: 'image/png',
    buffer: makeSolidPng(300, 600, [34 + rank * 60, 197, 94, 255]),
  }
}

function screenCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
  )
}

/** Les appareils qui portent réellement une capture, et pas seulement un châssis. */
function capturedDevices(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window.__sfStores?.useProjectStore.getState().project?.screens ?? []).filter((screen) =>
        screen.layers.some(
          (layer) =>
            layer.type === 'device-frame' &&
            typeof (layer as { screenshotAssetId?: string }).screenshotAssetId === 'string',
        ),
      ).length,
  )
}

/**
 * Un dépôt de fichiers sur la scène, monté dans la page.
 *
 * Playwright ne sait pas fabriquer de `DataTransfer` côté Node : il est
 * construit dans le document, rempli, puis passé à l'événement.
 */
async function dropFiles(
  page: Page,
  files: { name: string; type: string; bytes: number[] }[],
): Promise<void> {
  const transfer = await page.evaluateHandle((entries) => {
    const data = new DataTransfer()
    for (const entry of entries) {
      data.items.add(new File([new Uint8Array(entry.bytes)], entry.name, { type: entry.type }))
    }
    return data
  }, files)
  await page.dispatchEvent('.stage-grain', 'drop', { dataTransfer: transfer })
}
