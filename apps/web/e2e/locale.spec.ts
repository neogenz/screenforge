import { test, expect, type Page, type Route, type Locator } from '@playwright/test'
import { addTextLayer, expectNoClippedControl, expectNoRawIcon, waitForApp } from './helpers'

/**
 * La revue d'une langue, et le débordement qui l'arrête.
 *
 * Ce que la phase doit prouver de bout en bout : une langue ne duplique aucun
 * écran, une traduction trop longue est nommée sur sa propre ligne, l'export de
 * cette langue est refusé tant qu'elle déborde, et la correction lève le refus.
 * La langue d'origine, elle, reste exportable pendant tout ce temps — une
 * variante fautive n'a jamais bloqué le projet.
 *
 * Un second parcours vérifie le rédacteur partagé : le pont traduit un lot non
 * relu par position, jamais par identifiant de calque, et la relecture ne
 * touche que les textes d'origine qu'elle corrige réellement.
 */

const BRIDGE = 'http://127.0.0.1:4590'

interface LocaleState {
  code: string
  name: string
  script: string
  texts: Record<string, { value: string; reviewed: boolean }>
}

interface WriterCall {
  protocol: number
  target?: { code: string; name: string; script: string }
  source?: { code: string; name: string }
  language?: { code: string; name: string }
  context?: { appName?: string; pitch?: string }
  texts: string[]
  engine: string
}

async function locales(page: Page): Promise<LocaleState[]> {
  return page.evaluate(() =>
    JSON.parse(
      JSON.stringify(window.__sfStores?.useProjectStore.getState().project?.locales ?? []),
    ),
  )
}

async function screenCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
  )
}

function localeDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Langues' })
}

async function openLocales(page: Page) {
  await page.getByRole('button', { name: 'Ouvrir les langues' }).click()
  await expect(localeDialog(page)).toBeVisible()
}

/** La dernière ligne de revue : celle du texte que le test vient d'ajouter. */
function lastVariantField(page: Page) {
  return localeDialog(page).locator('li').last().getByRole('textbox')
}

/** Choisit une langue du catalogue par son libellé exact (« Nom · code ») et l'ajoute. */
async function addCatalogLocale(page: Page, dialog: Locator, label: string): Promise<void> {
  await dialog.getByLabel('Langue à ajouter').click()
  await page.getByRole('option', { name: label }).click()
  await dialog.getByRole('button', { name: 'Ajouter' }).click()
}

/** Les identifiants des calques de texte, dans l'ordre où `textLayersOf` les lit. */
async function textLayerIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    if (!project) return []
    return [...project.screens.flatMap((screen) => screen.layers), ...project.layoutLayers]
      .filter((layer) => layer.type === 'text')
      .map((layer) => layer.id)
  })
}

async function setLayerContent(page: Page, id: string, content: string): Promise<void> {
  await page.evaluate(
    ({ id, content }) => window.__sfStores?.useCanvasStore.getState().updateLayer(id, { content }),
    { id, content },
  )
}

/**
 * Le pont, doublé : il répond « hello » avec Claude Code installé, rend un seul
 * modèle, traduit en préfixant `[de] `, et ne corrige que le premier texte d'un
 * lot de relecture. Les corps de requête sont conservés pour être inspectés.
 */
async function fakeWriterBridge(
  page: Page,
): Promise<{ translateCalls: WriterCall[]; proofreadCalls: WriterCall[] }> {
  const translateCalls: WriterCall[] = []
  const proofreadCalls: WriterCall[] = []

  await page.route(`${BRIDGE}/hello`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        protocol: 7,
        bridge: '0.1.0',
        engines: [{ id: 'claude', version: '1.2.3' }],
        capabilities: { vision: false, structuredOutput: true, reasoning: true },
        ascAvailable: false,
        ascVersion: '',
        ascFlags: [],
        tokenVersions: { assistant: 1, 'asc-publish': 1 },
      }),
    }),
  )
  await page.route(`${BRIDGE}/models*`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ id: 'sonnet', displayName: 'Sonnet' }] }),
    }),
  )
  await page.route(`${BRIDGE}/translate`, (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as WriterCall
    translateCalls.push(body)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ texts: body.texts.map((text) => `[de] ${text}`) }),
    })
  })
  await page.route(`${BRIDGE}/proofread`, (route: Route) => {
    const body = JSON.parse(route.request().postData() ?? '{}') as WriterCall
    proofreadCalls.push(body)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        texts: body.texts.map((text, index) => (index === 0 ? `${text} corrigé` : text)),
      }),
    })
  })

  return { translateCalls, proofreadCalls }
}

test('une langue se relit, déborde, et bloque son seul export', async ({ page }) => {
  await waitForApp(page)
  await addTextLayer(page)
  const screensBefore = await screenCount(page)

  await openLocales(page)
  const dialog = localeDialog(page)
  await addCatalogLocale(page, dialog, 'Allemand · de-DE')

  // La langue ne duplique rien : elle ne porte que des textes.
  await expect.poll(async () => (await locales(page)).length).toBe(1)
  expect(await screenCount(page)).toBe(screensBefore)
  const created = (await locales(page))[0]
  expect(created).toMatchObject({ code: 'de-DE', name: 'Allemand', script: 'latin' })
  expect(Object.values(created.texts).every((text) => !text.reviewed)).toBe(true)

  // Une traduction qui ne tient plus est nommée sur sa ligne.
  await lastVariantField(page).fill(
    'Ein ausgesprochen langer deutscher Satz der in dieser Textbox niemals Platz finden wird',
  )
  await expect(dialog.getByRole('alert').filter({ hasText: 'px de texte' })).toBeVisible()
  await expect(dialog.getByText(/ne peut pas sortir/)).toBeVisible()

  await dialog.getByRole('button', { name: 'Fermer', exact: true }).last().click()

  // L'export de la langue d'origine reste possible ; celui de la variante non.
  await page.getByLabel('Ouvrir l’export').click()
  const exportDialog = page.getByRole('dialog', { name: 'Export officiel' })
  await expect(exportDialog).toBeVisible()
  const exportButton = exportDialog.getByRole('button', { name: /Exporter (le ZIP|les PNG)/ })
  await expect(exportButton).toBeEnabled()

  const languageSelect = exportDialog.getByLabel('Langue exportée')
  await expect(languageSelect).toContainText('Langue du projet')
  await languageSelect.click()
  await page.getByRole('option', { name: 'Allemand' }).click()
  await expect(exportDialog.getByRole('alert')).toContainText('Langues')
  await expect(exportButton).toBeDisabled()

  // Corrigée, la variante repasse.
  await exportDialog.getByRole('button', { name: 'Annuler' }).click()
  await openLocales(page)
  await lastVariantField(page).fill('Kurz')
  await expect(dialog.getByRole('alert').filter({ hasText: 'px de texte' })).toBeHidden()
  await expect(dialog.getByText(/est exportable/)).toBeVisible()
})

test('les flèches choisissent une seule langue et Tab sort du groupe', async ({ page }) => {
  await waitForApp(page)
  await openLocales(page)
  const dialog = localeDialog(page)

  await addCatalogLocale(page, dialog, 'Allemand · de-DE')
  await addCatalogLocale(page, dialog, 'Français · fr-FR')

  const group = dialog.getByRole('radiogroup', { name: 'Langue' })
  const german = group.getByRole('radio', { name: /de-DE Allemand/ })
  const french = group.getByRole('radio', { name: /fr-FR Français/ })
  await german.focus()
  await page.keyboard.press('ArrowRight')
  await expect(french).toBeFocused()
  await expect(french).toBeChecked()
  await expect(german).not.toBeChecked()

  await page.keyboard.press('Tab')
  expect(await group.evaluate((element) => element.contains(document.activeElement))).toBe(false)
})

/**
 * Le rédacteur branché traduit un lot non relu, puis relit l'original.
 *
 * Deux calques, deux positions : la traduction revient dans le même ordre
 * qu'elle est partie, jamais par un identifiant que le pont ne connaît pas — et
 * rien de ce qui part ne nomme un calque, un asset, ni une image. La relecture,
 * elle, ne corrige qu'un des deux textes : l'autre revient identique et ne doit
 * pas compter comme une correction.
 */
test('le rédacteur branché traduit les textes non relus, puis relit l’original', async ({
  page,
}) => {
  const { translateCalls, proofreadCalls } = await fakeWriterBridge(page)
  await waitForApp(page)

  await addTextLayer(page)
  await addTextLayer(page)
  const [firstId, secondId] = await textLayerIds(page)
  await setLayerContent(page, firstId, 'Bonjour')
  await setLayerContent(page, secondId, 'Au revoir')

  await openLocales(page)
  const dialog = localeDialog(page)
  await addCatalogLocale(page, dialog, 'Allemand · de-DE')

  const translateButton = dialog.getByRole('button', { name: 'Traduire les 2 textes non relus' })
  await expect(translateButton).toBeVisible()
  await expect(translateButton).toBeDisabled()
  await expect(dialog.getByText(/ScreenForge seul ne traduit ni ne relit/)).toBeVisible()

  /* Un <summary> n'est pas exposé comme un bouton ici (rôle « generic » mesuré) :
     on le cible par son texte plutôt que par un rôle ARIA qu'il ne porte pas. */
  const writerDisclosure = dialog.locator('summary').filter({ hasText: 'Qui traduit' })

  // Brancher Claude Code par le pont, doublé plus haut.
  await writerDisclosure.click()
  await dialog.getByRole('radio', { name: /Avec Claude Code/ }).click()
  const tokenField = dialog.getByLabel('Jeton d’appairage')
  await expect(tokenField).toBeEnabled()
  await tokenField.fill('jeton-factice')
  await dialog.getByRole('button', { name: 'Connecter' }).click()
  await expect(writerDisclosure).toContainText('Connecté')
  await expectNoRawIcon(page)
  await expectNoClippedControl(page)

  const row = (index: number) => dialog.locator('ul > li').nth(index)

  await expect(translateButton).toBeEnabled()
  await translateButton.click()
  await expect(page.getByText('2 textes traduits en Allemand : à relire.')).toBeVisible()

  await expect(row(0).getByRole('textbox')).toHaveValue('[de] Bonjour')
  await expect(row(1).getByRole('textbox')).toHaveValue('[de] Au revoir')
  await expect(row(0).getByRole('checkbox')).not.toBeChecked()
  await expect(row(1).getByRole('checkbox')).not.toBeChecked()

  expect(translateCalls).toHaveLength(1)
  const sent = translateCalls[0]
  expect(sent.protocol).toBe(7)
  expect(sent.target?.code).toBe('de-DE')
  expect(sent.source?.code).toBeTruthy()
  expect(sent.texts).toEqual(['Bonjour', 'Au revoir'])
  expect(JSON.stringify(sent)).not.toMatch(/layerId|assetId|data:image/)

  // Retouche manuelle : une ligne éditée à la main, puis déclarée relue.
  await row(0).getByRole('textbox').fill('[de] Bonjour, modifié')
  await row(0).getByRole('checkbox').check()
  await expect(row(0).getByRole('checkbox')).toBeChecked()

  // La relecture de l'original ne corrige qu'un texte sur deux.
  await dialog.getByRole('button', { name: 'Corriger l’orthographe des textes d’origine' }).click()
  await expect(page.getByText('1 texte corrigé.', { exact: true })).toBeVisible()
  await expect(row(0).getByText('Bonjour corrigé', { exact: true })).toBeVisible()
  await expect(row(1).getByText('Au revoir', { exact: true })).toBeVisible()

  expect(proofreadCalls).toHaveLength(1)
  expect(JSON.stringify(proofreadCalls[0])).not.toMatch(/layerId|assetId|data:image/)
})
