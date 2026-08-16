import { test, expect, type Page, type Route } from '@playwright/test'
import { addTextLayer, waitForApp } from './helpers'

/**
 * La publication, et l'ordre qu'elle ne peut pas inverser.
 *
 * Ce que la phase doit prouver de bout en bout : **rien ne part avant que le
 * lot ait été rendu depuis la release figée et rehaché**, aucun identifiant
 * Apple ne traverse ScreenForge, et `--replace` reste absent tant que personne
 * ne l'a coché. Le pont est remplacé par une doublure : aucun processus n'est
 * lancé, aucun octet ne quitte la machine, aucun credential n'existe.
 */

const BRIDGE = 'http://127.0.0.1:4590'

interface PublishCall {
  releaseId: string
  bundleHash: string
  target: { versionLocalization: string; deviceType: string }
  files: { name: string; base64: string }[]
  replaceExisting: boolean
  dryRun: boolean
}

/** Le faux pont : il répond, il enregistre, il ne lance rien. */
async function fakeBridge(page: Page): Promise<PublishCall[]> {
  const calls: PublishCall[] = []
  await page.route(`${BRIDGE}/hello`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocol: 3,
        bridge: '0.1.0',
        engines: [],
        capabilities: { vision: false, structuredOutput: true, reasoning: true },
        ascAvailable: true,
        ascVersion: '0.45.4-fake',
        ascFlags: ['--replace', '--dry-run', '--output'],
        tokenVersions: { assistant: 1, 'asc-publish': 1 },
      }),
    }),
  )
  await page.route(`${BRIDGE}/asc/publish`, (route: Route) => {
    calls.push(JSON.parse(route.request().postData() ?? '{}') as PublishCall)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        steps: [
          { name: 'verify-cli', status: 'ok', detail: 'asc 0.45.4-fake', ms: 3 },
          { name: 'write-temp', status: 'ok', detail: '1 planche', ms: 4 },
          { name: 'upload', status: 'ok', detail: 'Essai à blanc terminé', ms: 5 },
          { name: 'cleanup', status: 'ok', detail: 'Dossier temporaire supprimé', ms: 1 },
        ],
        command: ['asc', 'screenshots', 'upload'],
        idempotent: false,
        dryRun: true,
        replaceExisting: false,
        output: '{"uploaded":0}',
      }),
    })
  })
  return calls
}

function publishDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Publier chez Apple' })
}

async function freeze(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ouvrir les releases' }).click()
  await page.getByLabel('Nom du lot').fill(name)
  await page.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(new RegExp(`Release « ${name} » figée`))).toBeVisible({
    timeout: 30_000,
  })
  await page.keyboard.press('Escape')
}

test('un lot part seulement après avoir été rendu, et jamais en remplaçant', async ({ page }) => {
  const calls = await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '1.4.0')

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await expect(dialog).toBeVisible()

  // Destination incomplète : le preflight refuse avant tout rendu.
  await expect(dialog.getByRole('alert').first()).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Préparer le lot' })).toBeDisabled()

  await dialog.getByLabel('Identifiant de l’application').fill('com.exemple.cadence')
  await dialog.getByLabel('Version', { exact: true }).fill('1.4.0')
  await dialog.getByLabel('Identifiant de localisation de version').fill('LOC-1234')
  await expect(dialog.getByText(/Preflight sans réserve/)).toBeVisible()

  // Rien n'est publiable tant que le lot n'a pas été rendu et rehaché.
  await dialog.getByLabel('Jeton asc-publish').fill('jeton-de-test')
  await expect(dialog.getByRole('button', { name: /Essayer à blanc|Publier/ })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(dialog.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText(/asc screenshots upload/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Essayer à blanc' }).click()
  await expect(dialog.getByText(/Essai à blanc terminé/).first()).toBeVisible({ timeout: 30_000 })

  expect(calls).toHaveLength(1)
  const sent = calls[0]
  // Le lot envoyé est celui qui vient d'être rendu, avec son empreinte.
  expect(sent.bundleHash).toMatch(/^[a-f0-9]{64}$/)
  expect(sent.files).toHaveLength(1)
  expect(sent.files[0].name).toMatch(/^\d{2}_[a-z0-9_-]*\.png$/)
  expect(sent.target.deviceType).toBe('APP_IPHONE_69')
  // Jamais implicite : le drapeau destructeur n'est pas armé tout seul.
  expect(sent.replaceExisting).toBe(false)
  expect(sent.dryRun).toBe(true)

  /* Aucun identifiant Apple ne traverse ScreenForge, et le jeton ne se persiste
     pas. Les octets des planches sont écartés de la lecture : du base64 contient
     n'importe quelle suite de lettres, y compris celles qu'on cherche. */
  const body = JSON.stringify({ ...sent, files: sent.files.map((file) => file.name) })
  expect(body).not.toMatch(/p8|privateKey|issuerId|apiKey/i)
  const stored = await page.evaluate(() => ({
    local: JSON.stringify(window.localStorage),
    session: JSON.stringify(window.sessionStorage),
  }))
  expect(stored.local).not.toContain('jeton-de-test')
  expect(stored.session).not.toContain('jeton-de-test')
})

test('un lot filigrané ne se publie pas', async ({ page }) => {
  await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '0.9.0')
  // Compatibilité défensive : les nouveaux lots sont toujours propres, mais un
  // lot historique déjà figé avec l'ancien modèle reste refusé.
  await page.evaluate(() => {
    const store = window.__sfStores?.useProjectStore.getState()
    const project = store?.project
    if (!store || !project?.releases?.length) throw new Error('Release historique absente')
    window.__sfStores?.useProjectStore.setState({
      project: {
        ...project,
        releases: project.releases.map((release, index) =>
          index === project.releases!.length - 1 ? { ...release, watermarked: true } : release,
        ),
      },
    })
  })

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await dialog.getByLabel('Identifiant de l’application').fill('com.exemple.cadence')
  await dialog.getByLabel('Version', { exact: true }).fill('0.9.0')
  await dialog.getByLabel('Identifiant de localisation de version').fill('LOC-1234')

  await expect(dialog.getByRole('alert').filter({ hasText: /filigrane/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Préparer le lot' })).toBeDisabled()
})
