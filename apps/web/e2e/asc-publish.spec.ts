import { test, expect, type Page, type Route } from '@playwright/test'
import {
  addTextLayer,
  expectNoClippedControl,
  expectNoRawIcon,
  openAndroidProject,
  waitForApp,
} from './helpers'

/**
 * La publication, et l'ordre qu'elle ne peut pas inverser.
 *
 * Ce que la phase doit prouver de bout en bout : **rien ne part avant que le
 * lot ait été rendu depuis la version figée et rehaché**, aucun identifiant
 * Apple ne traverse ScreenForge, et `--replace` reste absent tant que personne
 * ne l'a coché. Le pont est remplacé par une doublure : aucun processus n'est
 * lancé, aucun octet ne quitte la machine, aucun credential n'existe. La
 * destination (application, version, langue) est lue chez la même doublure —
 * ce que la boîte propose par défaut doit être ce qu'un compte réel rendrait.
 */

const BRIDGE = 'http://127.0.0.1:4590'
const TOKEN = 'jeton-de-test'

interface PublishCall {
  releaseId: string
  bundleHash: string
  target: { versionLocalization: string; deviceType: string }
  files: { name: string; base64: string }[]
  replaceExisting: boolean
  dryRun: boolean
}

/** Refuse tout ce qui n'a pas le jeton attendu — comme le ferait le vrai pont. */
async function requireToken(route: Route): Promise<boolean> {
  if (route.request().headers()['authorization'] === `Bearer ${TOKEN}`) return true
  await route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'unauthorized', detail: 'Jeton de publication invalide.' }),
  })
  return false
}

/** Le faux pont : il répond, il enregistre, il ne lance rien. */
async function fakeBridge(page: Page): Promise<PublishCall[]> {
  const calls: PublishCall[] = []
  await page.route(`${BRIDGE}/hello`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocol: 7,
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
  await page.route(`${BRIDGE}/asc/apps`, async (route: Route) => {
    if (!(await requireToken(route))) return
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: '6758464920', name: 'Pulpe', bundleId: 'app.pulpe.ios', primaryLocale: 'fr-FR' },
        ],
      }),
    })
  })
  await page.route(`${BRIDGE}/asc/versions*`, async (route: Route) => {
    if (!(await requireToken(route))) return
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: 'VER-0', versionString: '1.3.0', state: 'READY_FOR_DISTRIBUTION', platform: 'IOS' },
          { id: 'VER-1', versionString: '1.4.0', state: 'PREPARE_FOR_SUBMISSION', platform: 'IOS' },
        ],
      }),
    })
  })
  await page.route(`${BRIDGE}/asc/localizations*`, async (route: Route) => {
    if (!(await requireToken(route))) return
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [{ id: 'LOC-FR', locale: 'fr-FR' }] }),
    })
  })
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
  return page.getByRole('dialog', { name: 'Publier sur App Store Connect' })
}

async function freeze(page: Page, name: string) {
  await page.getByRole('button', { name: 'Ouvrir les versions figées' }).click()
  await page.getByLabel('Nom de la version').fill(name)
  await page.getByRole('button', { name: 'Figer la version' }).click()
  await expect(page.getByText(new RegExp(`Version « ${name} » figée`))).toBeVisible({
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

  // Pont : constaté sans rien coller, puis le jeton donne accès aux applications.
  await expect(dialog.getByText(/asc 0\.45\.4-fake/)).toBeVisible()
  await dialog.getByLabel('Jeton asc-publish').fill(TOKEN)
  await dialog.getByRole('button', { name: 'Vérifier le pont' }).click()
  await expect(dialog.getByText('1 application lue chez Apple')).toBeVisible()

  await expectNoClippedControl(page)

  await dialog.getByRole('button', { name: 'Continuer' }).click()

  // Destination : l'application, la version modifiable et la langue sont lues,
  // jamais recopiées — 1.3.0 est déjà en vente, 1.4.0 attend encore une capture.
  await expect(dialog.getByText('Pulpe — app.pulpe.ios')).toBeVisible()
  await expect(dialog.getByText('1.4.0 · PREPARE_FOR_SUBMISSION')).toBeVisible()
  await expect(dialog.getByText(/Langue App Store : fr-FR/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Continuer' }).click()

  // Envoi : rien n'est publiable tant que le lot n'a pas été rendu et rehaché.
  await expect(dialog.getByText(/Preflight sans réserve/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: /Essayer à blanc|Publier/ })).toBeDisabled()

  await dialog.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(dialog.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 30_000 })
  await expect(dialog.getByText(/asc screenshots upload/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Essayer à blanc' }).click()
  await expect(dialog.getByText(/Essai à blanc terminé/).first()).toBeVisible({ timeout: 30_000 })

  // Preflight sans réserve et étapes de l'essai à blanc : c'est ici, pas à
  // l'étape « Pont », que les icônes du résultat sont montées.
  await expectNoRawIcon(page)

  expect(calls).toHaveLength(1)
  const sent = calls[0]
  // Le lot envoyé est celui qui vient d'être rendu, avec son empreinte, vers la
  // localisation lue chez Apple — jamais recopiée à la main.
  expect(sent.bundleHash).toMatch(/^[a-f0-9]{64}$/)
  expect(sent.files).toHaveLength(1)
  expect(sent.files[0].name).toMatch(/^\d{2}_[a-z0-9_-]*\.png$/)
  expect(sent.target.versionLocalization).toBe('LOC-FR')
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
  expect(stored.local).not.toContain(TOKEN)
  expect(stored.session).not.toContain(TOKEN)
})

test('une version déjà distribuée est nommée comme telle avant l’envoi', async ({ page }) => {
  await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '1.4.0')

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await dialog.getByLabel('Jeton asc-publish').fill(TOKEN)
  await dialog.getByRole('button', { name: 'Vérifier le pont' }).click()
  await expect(dialog.getByText('1 application lue chez Apple')).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuer' }).click()

  // La version modifiable est retenue d'office, sans réserve.
  await expect(dialog.getByText('1.4.0 · PREPARE_FOR_SUBMISSION')).toBeVisible()
  await expect(dialog.getByRole('alert').filter({ hasText: /déjà distribuée/ })).toHaveCount(0)

  // Celle déjà en vente peut être choisie, mais la boîte dit ce qu'Apple en fera.
  await dialog.getByRole('combobox', { name: 'Version', exact: true }).click()
  await page.getByRole('option', { name: '1.3.0 · READY_FOR_DISTRIBUTION' }).click()
  await expect(dialog.getByRole('alert').filter({ hasText: /déjà distribuée/ })).toBeVisible()
})

test('le chemin manuel reste complet sans lecture chez Apple', async ({ page }) => {
  await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '2.0.0')

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await dialog.getByRole('button', { name: 'Continuer' }).click()

  await dialog.getByText('Saisir les identifiants à la main').click()
  await dialog.getByLabel('Identifiant de l’application').fill('com.exemple.cadence')
  await dialog.getByLabel('Version', { exact: true }).fill('2.0.0')
  await dialog.getByLabel('Identifiant de localisation de version').fill('LOC-1234')

  await dialog.getByRole('button', { name: 'Continuer' }).click()
  await expect(dialog.getByText(/Preflight sans réserve/)).toBeVisible()
})

test('un lot filigrané ne se publie pas', async ({ page }) => {
  await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '0.9.0')
  // Compatibilité défensive : les nouveaux lots sont toujours propres, mais un
  // lot historique déjà figé avec l'ancien modèle reste refusé — quels que
  // soient l'application ou la version visées.
  await page.evaluate(() => {
    const store = window.__sfStores?.useProjectStore.getState()
    const project = store?.project
    if (!store || !project?.releases?.length) throw new Error('Version figée historique absente')
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
  await dialog.getByRole('button', { name: 'Continuer' }).click()
  await dialog.getByRole('button', { name: 'Continuer' }).click()

  await expect(dialog.getByRole('alert').filter({ hasText: /filigrane/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Préparer le lot' })).toBeDisabled()
  await expectNoRawIcon(page)
})

test('un projet Google Play ne propose ni n’exécute la publication Apple', async ({ page }) => {
  await waitForApp(page)
  await openAndroidProject(page)
  await expect(page.getByRole('button', { name: 'Publier chez Apple' })).toHaveCount(0)

  await page.evaluate(() => {
    ;(
      window.__sfStores?.useUIStore.setState as unknown as (
        partial: Record<string, unknown>,
      ) => void
    )({ showPublishDialog: true })
  })
  const dialog = publishDialog(page)
  await expect(dialog.getByRole('alert')).toContainText('réservée aux projets App Store')
  await expect(dialog.getByRole('button', { name: 'Préparer le lot' })).toHaveCount(0)
})

test('quand plusieurs versions sont figées, c’est celle qu’on désigne qui part', async ({
  page,
}) => {
  const calls = await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '1.4.0')
  await freeze(page, '1.4.1')
  const frozen = await page.evaluate(() =>
    (window.__sfStores?.useProjectStore.getState().project?.releases ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
    })),
  )
  expect(frozen.map((entry) => entry.name)).toEqual(['1.4.0', '1.4.1'])

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await dialog.getByLabel('Jeton asc-publish').fill(TOKEN)
  await dialog.getByRole('button', { name: 'Vérifier le pont' }).click()
  await expect(dialog.getByText('1 application lue chez Apple')).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuer' }).click()
  await dialog.getByRole('button', { name: 'Continuer' }).click()

  // La dernière est proposée. On désigne la première : un lot préparé pour
  // l'autre ne vaut plus rien, et c'est bien elle qui part.
  await expect(dialog.getByText(/Version figée : 1\.4\.1/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(dialog.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 30_000 })
  await dialog.getByLabel('Version figée').click()
  await page.getByRole('option', { name: '1.4.0', exact: true }).click()
  await expect(dialog.getByText(/Version figée : 1\.4\.0/)).toBeVisible()
  await expect(dialog.getByText(/Empreinte du lot/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(dialog.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole('button', { name: 'Essayer à blanc' }).click()
  await expect(dialog.getByText(/Essai à blanc terminé/).first()).toBeVisible({ timeout: 30_000 })

  expect(calls).toHaveLength(1)
  expect(calls[0].releaseId).toBe(frozen[0].id)
})

test('un envoi réel passe par une confirmation, et part sans essai ni remplacement', async ({
  page,
}) => {
  const calls = await fakeBridge(page)
  await waitForApp(page)
  await addTextLayer(page)
  await freeze(page, '1.4.0')

  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const dialog = publishDialog(page)
  await dialog.getByLabel('Jeton asc-publish').fill(TOKEN)
  await dialog.getByRole('button', { name: 'Vérifier le pont' }).click()
  await expect(dialog.getByText('1 application lue chez Apple')).toBeVisible()
  await dialog.getByRole('button', { name: 'Continuer' }).click()
  await dialog.getByRole('button', { name: 'Continuer' }).click()
  await dialog.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(dialog.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 30_000 })

  // L'essai à blanc décoché, l'action primaire devient « Publier » et ne part
  // qu'après confirmation : la seule chose entre un clic et Apple.
  await dialog.getByRole('switch', { name: 'Essai à blanc' }).click()
  await dialog.getByRole('button', { name: 'Publier', exact: true }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toBeVisible()
  expect(calls).toHaveLength(0)
  await confirm.getByRole('button', { name: 'Publier maintenant' }).click()

  await expect.poll(() => calls.length).toBe(1)
  expect(calls[0].dryRun).toBe(false)
  expect(calls[0].replaceExisting).toBe(false)
  expect(calls[0].releaseId).toBeTruthy()
})
