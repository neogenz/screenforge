import { expect, test } from '@playwright/test'
import { waitForApp, waitForCanvasSettled } from './helpers'

/**
 * Le presse-papiers survit au changement de projet.
 *
 * Les calques image ne portent qu'un `assetId` : le payload vit dans le
 * registre, que `hydrateAssets` vide au chargement d'un autre projet. Copier
 * un calque image dans le projet A puis le coller dans le projet B laissait
 * un identifiant orphelin — la synchronisation s'interrompait et le projet B,
 * une fois sauvegardé, était cassé. La copie capture donc les payloads et le
 * collage les ré-enregistre.
 */

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

test.describe('clipboard inter-projets', () => {
  test('coller un calque image copié dans un autre projet conserve l’image', async ({ page }) => {
    await waitForApp(page)

    const assetId = await page.evaluate((dataUrl) => {
      const id = window.__sfAssets!.registerAsset(dataUrl)
      const project = window.__sfStores!.useProjectStore.getState().project!
      window.__sfStores!.useProjectStore.getState().addScreenLayer(project.activeScreenId, {
        id: 'image-a',
        type: 'image',
        name: 'Image A',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 0,
        assetId: id,
        originalWidth: 1,
        originalHeight: 1,
      })
      return id
    }, PNG_1PX)
    await waitForCanvasSettled(page)

    // Copier le calque, comme un ⌘C sur la scène.
    await page.evaluate(() => {
      const stores = window.__sfStores as unknown as {
        useCanvasStore: { setState: (partial: { selectedLayerIds: string[] }) => void }
      }
      stores.useCanvasStore.setState({ selectedLayerIds: ['image-a'] })
    })
    await page.keyboard.press('Meta+c')

    /* Changer de projet : le registre est réhydraté avec les assets du projet
       B, ceux du projet A disparaissent — c'est le geste qui orphelinaít
       l'identifiant copié. */
    await page.evaluate(() => {
      window.__sfAssets!.clearAssets()
      window.__sfStores!.useProjectStore.getState().createProject('Projet B')
    })
    await waitForCanvasSettled(page)
    expect(await page.evaluate((id) => Boolean(window.__sfAssets!.resolveAsset(id)), assetId)).toBe(
      false,
    )

    await page.keyboard.press('Meta+v')
    await waitForCanvasSettled(page)

    const pasted = await page.evaluate(() => {
      const project = window.__sfStores!.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      if (!layer || layer.type !== 'image') return null
      return {
        assetId: layer.assetId,
        resolvable: Boolean(window.__sfAssets!.resolveAsset(layer.assetId)),
      }
    })
    expect(pasted, 'le calque image collé doit référencer un asset résolvable').not.toBeNull()
    expect(pasted!.resolvable).toBe(true)

    // Et l'objet est réellement rendu, pas seulement présent dans le projet.
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.__sfCanvas
            ?.getObjects()
            .some(
              (object) =>
                (object as { data?: { rendererType?: string } }).data?.rendererType === 'image',
            ),
        ),
      )
      .toBe(true)

    /* Recharger le projet B : l'asset ré-enregistré au collage a été marqué
       sale, donc persisté avec la sauvegarde — l'image survit au rechargement. */
    await page.evaluate(async () => {
      const storagePath = '/src/lib/storage.ts'
      const { saveCurrentProject } = (await import(
        storagePath
      )) as typeof import('../src/lib/storage')
      await saveCurrentProject()
    })
    await page.reload()
    await waitForApp(page)
    const afterReload = await page.evaluate(() => {
      const project = window.__sfStores!.useProjectStore.getState().project
      const layer = project?.screens
        .flatMap((screen) => screen.layers)
        .find((candidate) => candidate.type === 'image')
      if (!layer || layer.type !== 'image') return null
      return Boolean(window.__sfAssets!.resolveAsset(layer.assetId))
    })
    expect(afterReload, 'l’image collée doit survivre au rechargement du projet B').toBe(true)
  })
})
