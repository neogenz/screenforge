import { test, expect, type Page, type Route } from '@playwright/test'
import { addScreen, readDownload, waitForApp } from './helpers'
import { makeSolidPng } from './device-bezel-fixture'
import { validateExportZip } from '../../../scripts/validate-export.mjs'

/**
 * Le cycle de vie entier, dans une seule session.
 *
 * Chaque phase a sa suite ciblée ; celle-ci ne les répète pas. Elle vérifie ce
 * qu'aucune ne peut voir seule : que les dix étapes tiennent **enchaînées**,
 * sur un même projet, sans que l'une défasse le travail d'une autre.
 *
 * C'est là que se logent les défauts que des suites isolées laissent passer :
 * un lot de captures qui perdrait les cadrages posés à l'étape précédente, une
 * langue qui contaminerait la release d'origine, une release figée qui suivrait
 * le projet au lieu de rester à sa date, une publication qui partirait du
 * projet vivant plutôt que du lot relu.
 *
 * Aucun credential réel : le pont est une doublure, le fournisseur est le
 * générateur local, et les captures sont des PNG produits par le test.
 */

const BRIDGE = 'http://127.0.0.1:4590'

interface PublishCall {
  releaseId: string
  bundleHash: string
  files: { name: string }[]
  replaceExisting: boolean
  dryRun: boolean
}

interface ScreenState {
  id: string
  name: string
  layers: {
    type: string
    id: string
    content?: string
    slot?: string
    placement?: { zoom: number }
    screenshotSize?: { width: number; height: number }
  }[]
}

async function screens(page: Page): Promise<ScreenState[]> {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(window.__sfStores?.useProjectStore.getState().project?.screens ?? []),
    ),
  )
}

async function releases(page: Page) {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(window.__sfStores?.useProjectStore.getState().project?.releases ?? []),
    ),
  ) as Promise<{ id: string; name: string; locale?: string; files: { sha256: string }[] }[]>
}

/** Le pont, remplacé : il répond et enregistre, il ne lance aucun processus. */
async function fakeBridge(page: Page): Promise<PublishCall[]> {
  const calls: PublishCall[] = []
  await page.route(`${BRIDGE}/hello`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocol: 4,
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
        steps: [{ name: 'upload', status: 'ok', detail: 'Essai à blanc terminé', ms: 5 }],
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

/* Le rendu de deux lots complets et un export tiennent mal dans le délai d'un
   test ordinaire : c'est le prix d'un parcours qui ne triche sur aucune étape. */
test.setTimeout(240_000)

test('les dix étapes d’une campagne tiennent enchaînées', async ({ page }) => {
  const published = await fakeBridge(page)
  await waitForApp(page)

  // 1) Créer la campagne : deux visuels générés, en calques réels.
  await page.getByRole('button', { name: 'Générer les visuels App Store' }).click()
  await page.getByLabel('Nom de l’app').fill('Cadence')
  await page.getByLabel('Accroche générale vérifiée (3 à 7 mots)').fill('Le budget dans une poche')
  await page.getByLabel('Combien de visuels').click()
  await page.getByRole('option', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: /^Proposer \d+ visuels?$/ }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez la proposition' })).toBeVisible()
  await page.getByRole('button', { name: /^Ajouter \d+ visuels?$/ }).click()
  await expect(page.getByRole('dialog', { name: 'Générer les visuels App Store' })).toBeHidden()
  await expect.poll(async () => (await screens(page)).length).toBeGreaterThan(1)

  // 2) Icône et forme : le catalogue vectoriel, éditable comme le reste.
  await page.locator('button[aria-label="Ajouter Icône"]').click()
  await page.locator('button[aria-label="Ajouter Forme"]').click()
  const activeId = await page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.activeScreenId,
  )
  const current = (await screens(page)).find((screen) => screen.id === activeId)
  expect(current?.layers.map((layer) => layer.type)).toEqual(
    expect.arrayContaining(['icon', 'shape']),
  )

  // 3) Le rôle et le cadrage, posés une fois pour toutes les releases à venir.
  await addScreen(page)
  await page.locator('button[aria-label="Ajouter un cadre iPhone"]').click()
  await page.getByRole('menuitem', { name: /iPhone 17 Pro Max/ }).click()
  const role = page.getByLabel('Rôle de l’écran dans la campagne')
  await role.fill('reglages')
  await role.blur()
  await page.getByLabel('Importer la capture de l’app').setInputFiles({
    name: 'origine.png',
    mimeType: 'image/png',
    buffer: makeSolidPng(300, 600, [40, 40, 40, 255]),
  })
  const zoom = page.getByRole('slider', { name: 'Zoom de la capture' })
  await zoom.focus()
  for (let step = 0; step < 4; step += 1) await zoom.press('ArrowRight')
  const framed = await page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const screen = project?.screens.find((candidate) => candidate.id === project.activeScreenId)
    const device = screen?.layers.find((layer) => layer.type === 'device-frame')
    return (device as { placement?: { zoom: number } } | undefined)?.placement?.zoom ?? 1
  })
  expect(framed, 'le cadrage n’a pas été réglé').toBeGreaterThan(1)

  // 4) et 5) Une nouvelle livraison : appariée par rôle, appliquée d'un bloc.
  await page.getByRole('button', { name: 'Actualiser les captures' }).click()
  const refresh = page.getByRole('dialog', { name: 'Actualiser les captures' })
  await expect(refresh).toBeVisible()
  await refresh.getByLabel('Captures à poser').setInputFiles([
    {
      name: 'reglages.png',
      mimeType: 'image/png',
      buffer: makeSolidPng(400, 800, [232, 32, 48, 255]),
    },
  ])
  await refresh.getByRole('button', { name: /Remplacer \d+ capture/ }).click()
  await expect(refresh).toBeHidden()

  // La capture a changé, le cadrage réglé à l'étape 3 est resté.
  const refreshed = await page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const device = (project?.screens ?? [])
      .flatMap((screen) => screen.layers)
      .find(
        (layer) =>
          layer.type === 'device-frame' && (layer as { slot?: string }).slot === 'reglages',
      )
    return JSON.parse(JSON.stringify(device)) as {
      screenshotSize?: { width: number }
      placement?: { zoom: number }
    }
  })
  expect(refreshed.screenshotSize?.width).toBe(400)
  expect(refreshed.placement?.zoom).toBeCloseTo(framed, 5)

  // 6) Retoucher un écran via le fournisseur : borné à l'écran courant.
  const beforeTouch = await screens(page)
  await page.getByRole('button', { name: 'Générer les visuels App Store' }).click()
  await page.getByRole('radio', { name: 'Nocturne' }).click()
  await page.getByRole('button', { name: /^Appliquer à/ }).click()
  await expect(page.getByRole('dialog', { name: 'Générer les visuels App Store' })).toBeHidden()
  const afterTouch = await screens(page)
  expect(afterTouch[0], 'la retouche a débordé sur un autre écran').toEqual(beforeTouch[0])

  // 7) Une langue, et le débordement qu'elle signale puis lève.
  await page.getByRole('button', { name: 'Ouvrir les langues' }).click()
  const locales = page.getByRole('dialog', { name: 'Langues' })
  await locales.getByLabel('Code').fill('de')
  await locales.getByLabel('Nom').fill('Allemand')
  await locales.getByRole('button', { name: 'Ajouter' }).click()
  const variant = locales.locator('li').last().getByRole('textbox')
  await variant.fill(
    'Ein ausgesprochen langer deutscher Satz der in dieser Textbox niemals Platz finden wird',
  )
  await expect(locales.getByRole('alert').filter({ hasText: 'px de texte' })).toBeVisible()
  await expect(locales.getByText(/ne peut pas sortir/)).toBeVisible()
  await variant.fill('Budget')
  await expect(locales.getByRole('alert').filter({ hasText: 'px de texte' })).toBeHidden()
  await expect(locales.getByText(/est exportable/)).toBeVisible()
  await page.keyboard.press('Escape')
  // Une langue n'ajoute pas d'écran : elle ne porte que des textes.
  expect(await screens(page)).toHaveLength(afterTouch.length)

  // 8) Figer un lot, dans cette langue, et le laisser immuable.
  await page.getByRole('button', { name: 'Ouvrir les releases' }).click()
  const releaseDialog = page.getByRole('dialog', { name: 'Releases' })
  await releaseDialog.getByLabel('Nom du lot').fill('1.4.0')
  await releaseDialog.getByLabel('Langue du lot').click()
  await page.getByRole('option', { name: 'Allemand' }).click()
  await releaseDialog.getByRole('button', { name: 'Figer une release' }).click()
  await expect(page.getByText(/Release « 1.4.0 » figée/)).toBeVisible({ timeout: 120_000 })
  await page.keyboard.press('Escape')

  const frozen = await releases(page)
  expect(frozen).toHaveLength(1)
  expect(frozen[0].locale).toBe('de')
  const fingerprints = frozen[0].files.map((file) => file.sha256)

  // Le projet continue de vivre : la release ne bouge pas avec lui.
  await page.locator('button[aria-label="Ajouter Texte"]').click()
  const afterEdit = await releases(page)
  expect(afterEdit[0].files.map((file) => file.sha256)).toEqual(fingerprints)

  // 9) Exporter : un ZIP de PNG aux dimensions Apple.
  await page.getByLabel('Ouvrir l’export').click()
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'Exporter le ZIP' }).click(),
  ])
  /* Le validateur livré avec le dépôt, sur le ZIP réel : c'est le seul endroit
     où il tourne autrement qu'à la main, et il vérifie ce qu'aucune assertion
     de dimension ne voit — la numérotation continue, le nombre de planches, et
     le poids de chacune. */
  const bundle = await readDownload(download)
  const validated = await validateExportZip(bundle)
  expect(validated.length).toBe(afterTouch.length)
  expect(validated.every((file) => file.width === 1320 && file.height === 2868)).toBe(true)
  await page.keyboard.press('Escape')

  // 10) Preflight puis essai à blanc : le lot figé, jamais le projet vivant.
  await page.getByRole('button', { name: 'Publier chez Apple' }).click()
  const publish = page.getByRole('dialog', { name: 'Publier chez Apple' })
  await publish.getByLabel('Identifiant de l’application').fill('com.exemple.cadence')
  await publish.getByLabel('Version', { exact: true }).fill('1.4.0')
  await publish.getByLabel('Langue App Store').click()
  await page.getByRole('option', { name: 'de-DE', exact: true }).click()
  await publish.getByLabel('Identifiant de localisation de version').fill('LOC-1234')
  await expect(publish.getByText(/Preflight sans réserve/)).toBeVisible()

  await publish.getByLabel('Jeton asc-publish').fill('jeton-de-test')
  await publish.getByRole('button', { name: 'Préparer le lot' }).click()
  await expect(publish.getByText(/Empreinte du lot/)).toBeVisible({ timeout: 120_000 })
  await publish.getByRole('button', { name: 'Essayer à blanc' }).click()
  await expect(publish.getByText(/Essai à blanc terminé/).first()).toBeVisible({ timeout: 60_000 })

  expect(published).toHaveLength(1)
  // Ce qui est parti est le lot figé à l'étape 8, pas les écrans d'aujourd'hui.
  expect(published[0].releaseId).toBe(frozen[0].id)
  expect(published[0].files).toHaveLength(fingerprints.length)
  expect(published[0].bundleHash).toMatch(/^[a-f0-9]{64}$/)
  // Rien de destructeur ne s'arme tout seul au bout de dix étapes.
  expect(published[0].replaceExisting).toBe(false)
  expect(published[0].dryRun).toBe(true)
})
