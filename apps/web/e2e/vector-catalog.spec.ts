import { test, expect, type Page } from '@playwright/test'
import { decode } from 'fast-png'
import {
  addShapeLayer,
  downloadFirstExportedPng,
  waitForApp,
  waitForCanvasSettled,
} from './helpers'
import type { Layer } from '../src/types'

/**
 * Le catalogue mesuré par un vrai moteur SVG.
 *
 * Les tracés d'une icône sont concaténés en un seul `d` — un sous-tracé
 * relatif qui repartirait du point courant du précédent sortirait de la boîte
 * de 24 sans qu'aucune relecture ne le voie. `getBBox` le voit.
 */

async function catalogBoxes(page: Page) {
  return page.evaluate(async () => {
    /* L'URL est servie par Vite au navigateur, pas résolue par TypeScript :
       elle passe par une variable pour que le compilateur la laisse tranquille,
       comme le fait déjà `window.__sfAssets` dans les helpers. */
    const specifier = '/src/lib/vector-catalog.ts'
    const catalog = (await import(specifier)) as typeof import('../src/lib/vector-catalog')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    document.body.append(svg)
    const measure = (d: string) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      node.setAttribute('d', d)
      svg.append(node)
      const box = node.getBBox()
      node.remove()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }
    const shapes = catalog.SHAPE_CATALOG.filter((entry) => entry.path).map((entry) => ({
      id: entry.id as string,
      box: measure(entry.path as string),
      limit: catalog.SHAPE_BOX,
      declared: [...catalog.drawnBox(entry)] as number[],
    }))
    const icons = catalog.ICON_CATALOG.map((entry) => ({
      id: entry.id as string,
      box: measure(entry.path),
      limit: catalog.ICON_BOX,
      declared: null,
    }))
    svg.remove()
    return [...shapes, ...icons]
  })
}

test('chaque tracé du catalogue tient dans sa boîte', async ({ page }) => {
  await waitForApp(page)
  const entries = await catalogBoxes(page)
  expect(entries.length).toBeGreaterThan(40)

  for (const { id, box, limit } of entries) {
    // Une marge d'un demi-pixel : un arc peut dépasser son point de contrôle.
    expect(box.x, `${id} déborde à gauche`).toBeGreaterThanOrEqual(-0.5)
    expect(box.y, `${id} déborde en haut`).toBeGreaterThanOrEqual(-0.5)
    expect(box.x + box.width, `${id} déborde à droite`).toBeLessThanOrEqual(limit + 0.5)
    expect(box.y + box.height, `${id} déborde en bas`).toBeLessThanOrEqual(limit + 0.5)
    /* Un tracé disloqué s'effondre ou explose. Le plancher est par axe et bas
       — une ligne est un bandeau, elle n'a pas à être haute — mais le plus
       grand des deux côtés doit occuper la moitié de la boîte. */
    expect(box.width, `${id} est trop étroit`).toBeGreaterThan(limit / 10)
    expect(box.height, `${id} est trop plat`).toBeGreaterThan(limit / 10)
    expect(Math.max(box.width, box.height), `${id} n'occupe pas sa boîte`).toBeGreaterThan(
      limit / 2,
    )
  }
})

/**
 * `drawn` dit ce que le tracé occupe vraiment, et c'est mesuré ici.
 *
 * L'aperçu de campagne dessine ces formes en SVG là où l'éditeur les dessine
 * par Fabric, et Fabric met un tracé à l'échelle de sa propre boîte englobante.
 * Les deux ne coïncident que si le `viewBox` de l'aperçu est cette boîte-là.
 * Elle était supposée valoir 100 × 100 pour toutes : « Ligne » en fait 100 × 12,
 * ce qui rendait un pavé plein sur la planche et un filet dans l'aperçu — la
 * revue montrait une composition que la pose ne produisait pas. Un chiffre
 * recopié à la main se serait démodé au premier tracé retouché ; celui-ci est
 * relu par un vrai moteur SVG à chaque exécution.
 */
test('ce qu’une forme déclare occuper est ce qu’elle occupe', async ({ page }) => {
  await waitForApp(page)
  for (const { id, box, declared } of await catalogBoxes(page)) {
    if (!declared) continue
    const measured = [box.x, box.y, box.width, box.height]
    for (const [at, value] of measured.entries()) {
      expect(declared[at], `${id} — ${['x', 'y', 'largeur', 'hauteur'][at]}`).toBeCloseTo(value, 1)
    }
  }
})

async function firstLayer(page: Page, type: Layer['type']) {
  return page.evaluate((wanted) => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layer = [...(screen?.layers ?? []), ...(project?.layoutLayers ?? [])].find(
      (item) => item.type === wanted,
    )
    return layer ? (JSON.parse(JSON.stringify(layer)) as Record<string, unknown>) : null
  }, type)
}

async function renderedObject(page: Page, rendererType: string) {
  return page.evaluate((type) => {
    const object = window.__sfCanvas
      ?.getObjects()
      .find(
        (candidate) =>
          (candidate as { data?: { rendererType?: string } }).data?.rendererType === type,
      ) as
      | { type?: string; stroke?: string; data?: { resourceKey?: string }; width?: number }
      | undefined
    if (!object) return null
    return {
      type: object.type,
      stroke: object.stroke,
      resourceKey: object.data?.resourceKey,
      width: object.width,
    }
  }, rendererType)
}

test('une icône s’ajoute, se change et survit au rechargement', async ({ page }) => {
  await waitForApp(page)
  await page.locator('button[aria-label="Ajouter Icône"]').click()
  await expect.poll(async () => firstLayer(page, 'icon')).not.toBeNull()

  const added = await firstLayer(page, 'icon')
  expect(added).toMatchObject({ iconId: 'star', name: 'Étoile' })
  // Le rapport de la boîte suit le tracé : une étoile est carrée, pas une coche.
  expect(await renderedObject(page, 'icon')).toMatchObject({ type: 'path' })

  await page.getByRole('button', { name: /^Icône : / }).click()
  await page.getByRole('option', { name: 'Coche' }).click()
  await expect.poll(async () => (await firstLayer(page, 'icon'))?.iconId).toBe('check')
  expect(await firstLayer(page, 'icon')).toMatchObject({ name: 'Coche' })

  await page.keyboard.press('ControlOrMeta+z')
  await expect.poll(async () => (await firstLayer(page, 'icon'))?.iconId).toBe('star')

  await expect(page.getByRole('status')).toContainText('Enregistré', { timeout: 10_000 })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__sfCanvas))
  expect(await firstLayer(page, 'icon')).toMatchObject({ iconId: 'star' })
  await expect.poll(async () => (await renderedObject(page, 'icon'))?.type).toBe('path')
})

test('une forme tracée se choisit dans le sélecteur et se rend en chemin', async ({ page }) => {
  await waitForApp(page)
  await addShapeLayer(page)
  expect(await renderedObject(page, 'shape')).toMatchObject({ type: 'rect' })

  await page.getByRole('button', { name: /^Forme : / }).click()
  await page.getByRole('option', { name: 'Étoile' }).click()
  await expect.poll(async () => (await firstLayer(page, 'shape'))?.shapeType).toBe('star')
  await waitForCanvasSettled(page)

  const object = await renderedObject(page, 'shape')
  expect(object?.type).toBe('path')
  expect(object?.resourceKey).toBe('shape:star')

  // Le filtre du sélecteur : un mot, une entrée.
  await page.getByRole('button', { name: /^Forme : / }).click()
  await page.getByRole('searchbox', { name: 'Rechercher une forme…' }).fill('vag')
  // Porté par la liste du sélecteur : le panneau des calques est aussi une liste.
  await expect(page.getByRole('listbox', { name: 'Forme' }).getByRole('option')).toHaveCount(1)
  await page.getByRole('option', { name: 'Vague' }).click()
  await expect.poll(async () => (await firstLayer(page, 'shape'))?.shapeType).toBe('wave')
})

test('la grille vectorielle suit ses cinq colonnes au clavier', async ({ page }) => {
  await waitForApp(page)
  await addShapeLayer(page)

  const trigger = page.getByRole('button', { name: /^Forme : / })
  await trigger.click()
  const search = page.getByRole('searchbox', { name: 'Rechercher une forme…' })
  const list = page.getByRole('listbox', { name: 'Forme' })
  const options = list.getByRole('option')
  await expect
    .poll(() => options.evaluateAll((nodes) => nodes.filter((node) => node.tabIndex === 0).length))
    .toBe(1)

  await search.press('ArrowDown')
  await expect(list.getByRole('option', { name: 'Rectangle' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(list.getByRole('option', { name: 'Arrondi' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(list.getByRole('option', { name: 'Losange' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(list.getByRole('option', { name: 'Triangle' })).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(list.getByRole('option', { name: 'Rectangle' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await firstLayer(page, 'shape'))?.shapeType).toBe('triangle')
  await expect(trigger).toBeFocused()

  await trigger.click()
  const reopenedSearch = page.getByRole('searchbox', { name: 'Rechercher une forme…' })
  await reopenedSearch.fill('aucun-vecteur')
  await expect(page.getByText('Aucun résultat', { exact: true })).toBeVisible()
  await reopenedSearch.press('Escape')
  await expect(trigger).toBeFocused()
  await expect.poll(async () => (await firstLayer(page, 'shape'))?.shapeType).toBe('triangle')
})

test('une forme et une icône sortent dans le PNG exporté', async ({ page }) => {
  await waitForApp(page)
  await addShapeLayer(page)
  await page.getByRole('button', { name: /^Forme : / }).click()
  await page.getByRole('option', { name: 'Losange' }).click()
  await expect.poll(async () => (await firstLayer(page, 'shape'))?.shapeType).toBe('diamond')

  await page.locator('button[aria-label="Ajouter Icône"]').click()
  await expect.poll(async () => firstLayer(page, 'icon')).not.toBeNull()
  await waitForCanvasSettled(page)

  const boxes = await page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const layers = screen?.layers ?? []
    const pick = (type: string) => layers.find((layer) => layer.type === type)
    const shape = pick('shape')
    const icon = pick('icon')
    if (!shape || !icon) throw new Error('layers missing')
    return {
      shape: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
      icon: { x: icon.x, y: icon.y, width: icon.width, height: icon.height },
    }
  })

  const { png } = await downloadFirstExportedPng(page)
  const decoded = decode(png)
  // La planche fait 440 de large pour 1320 exportés : le facteur est 3.
  const pixel = (boardX: number, boardY: number) => {
    const offset =
      (Math.floor(boardY * 3) * decoded.width + Math.floor(boardX * 3)) * decoded.channels
    return Array.from(decoded.data.slice(offset, offset + 3))
  }
  const background = pixel(4, 4)

  // Le centre du losange est plein, ses coins sont hors du tracé : c'est ce qui
  // distingue une forme tracée du rectangle qu'elle remplaçait.
  const center = pixel(
    boxes.shape.x + boxes.shape.width / 2,
    boxes.shape.y + boxes.shape.height / 2,
  )
  expect(center).not.toEqual(background)
  expect(pixel(boxes.shape.x + 2, boxes.shape.y + 2)).toEqual(background)

  // L'icône est dessinée au trait : sa boîte porte de l'encre quelque part.
  const inked: number[][] = []
  for (let step = 0; step <= 20; step += 1) {
    inked.push(
      pixel(boxes.icon.x + (boxes.icon.width * step) / 20, boxes.icon.y + boxes.icon.height / 2),
    )
  }
  expect(inked.some((sample) => sample.join() !== background.join())).toBe(true)
})
