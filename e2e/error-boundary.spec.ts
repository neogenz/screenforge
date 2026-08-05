import { expect, test, type Page } from '@playwright/test'
import { waitForApp } from './helpers'

async function crashApp(page: Page): Promise<void> {
  await waitForApp(page)
  await page.evaluate(() => window.__sfCrash?.())
  await expect(page.getByRole('heading', { name: 'ScreenForge doit redémarrer' })).toBeVisible()
}

test.describe('global error recovery', () => {
  test('focuses the reload action and recovers after reload', async ({ page }) => {
    await crashApp(page)
    const reload = page.getByRole('button', { name: 'Recharger l’application' })
    await expect(reload).toBeFocused()

    await Promise.all([page.waitForEvent('load'), reload.click()])
    await expect(page.getByLabel('Ouvrir l’export')).toBeVisible()
  })

  test('requires confirmation before atomically deleting the active project', async ({ page }) => {
    await crashApp(page)
    const ids = await page.evaluate(async () => {
      const project = window.__sfStores?.useProjectStore.getState().project
      if (!project) throw new Error('Active project missing')
      const projectId = project.id
      const assetId = crypto.randomUUID()
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('screenforge', 2)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const transaction = database.transaction(['projects', 'assets'], 'readwrite')
      transaction.objectStore('projects').put(project)
      transaction.objectStore('assets').put({
        id: assetId,
        projectId,
        dataUrl: 'data:image/png;base64,AA==',
      })
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      database.close()
      return { projectId, assetId }
    })
    const reset = page.getByRole('button', { name: 'Réinitialiser le projet' })

    page.once('dialog', (dialog) => void dialog.dismiss())
    await reset.click()
    expect(await storedRecords(page, ids)).toEqual({ project: true, asset: true })

    page.once('dialog', (dialog) => void dialog.accept())
    await Promise.all([page.waitForEvent('load'), reset.click()])
    expect(await storedRecords(page, ids)).toEqual({ project: false, asset: false })
  })
})

async function storedRecords(
  page: Page,
  ids: { projectId: string; assetId: string },
): Promise<{ project: boolean; asset: boolean }> {
  return page.evaluate(async ({ projectId, assetId }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('screenforge', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction(['projects', 'assets'])
    const read = (store: string, key: string) =>
      new Promise<boolean>((resolve, reject) => {
        const request = transaction.objectStore(store).get(key)
        request.onsuccess = () => resolve(Boolean(request.result))
        request.onerror = () => reject(request.error)
      })
    const [project, asset] = await Promise.all([
      read('projects', projectId),
      read('assets', assetId),
    ])
    database.close()
    return { project, asset }
  }, ids)
}
