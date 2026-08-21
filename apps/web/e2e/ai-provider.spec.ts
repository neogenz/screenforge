import { test, expect, type Page, type Route } from '@playwright/test'
import { waitForApp } from './helpers'

/**
 * Le chemin recommandé reste le chemin par défaut, et les autres s'installent.
 *
 * Ce que la phase doit prouver côté page : les fournisseurs qui coûtent quelque
 * chose existent, sont repliés, disent où passent les données, et se branchent
 * par une marche à suivre qui commence par ce qu'on peut constater. Rien de tout
 * cela ne doit coûter à l'utilisateur la génération sans modèle, qui marche sans
 * rien connecter.
 *
 * Le pont est éteint pendant ce test, et c'est le test qui l'éteint : l'état par
 * défaut d'une machine est ce que tout le monde lira en premier, mais celle qui
 * fait tourner cette suite est justement celle où quelqu'un développe le pont.
 * La supposition tenait dans un commentaire et échouait dès qu'elle était
 * fausse ; elle est maintenant une interception.
 *
 * Aucun identifiant réel : la clé est une chaîne factice et l'API d'Anthropic
 * est interceptée — aucune requête ne sort d'ici.
 */

const DIALOG = 'Générer les visuels App Store'

async function openCampaignDialog(page: Page) {
  await page.getByRole('button', { name: DIALOG }).click()
  await expect(page.getByRole('dialog', { name: DIALOG })).toBeVisible()
}

test('le choix du modèle est replié, honnête, et jamais bloquant', async ({ page }) => {
  await waitForApp(page)
  await openCampaignDialog(page)

  // La rangée dit lequel est actif sans qu'on entre dans la sous-vue.
  const disclosure = page.getByRole('button', { name: /Qui écrit les accroches/ })
  await expect(disclosure).toContainText('ScreenForge seul, sans IA')
  await expect(page.getByRole('radio', { name: /ScreenForge seul/ })).toBeHidden()

  // La sous-vue s'ouvre, et son retour vit en haut à gauche de la boîte.
  await disclosure.click()
  await expect(page.getByRole('button', { name: 'Retour au brief' })).toBeVisible()

  const local = page.getByRole('radio', { name: /ScreenForge seul/ })
  const claude = page.getByRole('radio', { name: /Avec Claude Code/ })
  const openRouter = page.getByRole('radio', { name: /clé OpenRouter/ })

  // Les choix se parcourent d'un coup d'œil. Seul le fournisseur retenu
  // explique son fonctionnement, et le trajet exact des données reste à un
  // geste : l'information sensible est conservée sans être répétée cinq fois.
  await expect(local.locator('..')).toContainText('Local · sans compte')
  await expect(claude.locator('..')).toContainText('Sur cet ordinateur · sans clé')
  await expect(openRouter.locator('..')).toContainText('En ligne · votre clé')
  const privacy = page.getByText('Données et confidentialité')
  await expect(page.getByText(/Rien ne quitte cet onglet/)).toBeHidden()
  await privacy.click()
  await expect(page.getByText(/Rien ne quitte cet onglet/)).toBeVisible()

  await claude.click()
  await expect(page.getByText(/via le Claude Code déjà installé/)).toBeVisible()
  await expect(page.getByText(/aucune image ne traverse le pont/)).toBeHidden()
  await privacy.click()
  await expect(page.getByText(/aucune image ne traverse le pont/)).toBeVisible()

  await local.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(openRouter).toBeFocused()
  await expect(openRouter).toBeChecked()
  await page.keyboard.press('Tab')
  expect(
    await page
      .getByRole('radiogroup', { name: 'Qui écrit les accroches' })
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(false)

  // Et la voie recommandée reste à un clic, sans rien connecter.
  await local.click()
  await page.getByRole('button', { name: 'Retour au brief' }).click()
  await page.getByLabel('Nom de l’app').fill('Cadence')
  await page.getByRole('button', { name: /^Proposer \d+ visuels?$/ }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez la proposition' })).toBeVisible()
})

test('le pont éteint est constaté, pas découvert après coup', async ({ page }) => {
  /* Un port fermé, quoi qu'il y ait sur cette machine. `abort` fait rejeter
     `fetch` avec le `TypeError` d'une connexion refusée, qui est exactement ce
     que `probeBridge` traduit en « injoignable ». */
  await page.route('http://127.0.0.1:4590/**', (route: Route) => route.abort())

  await waitForApp(page)
  await openCampaignDialog(page)
  await page.getByRole('button', { name: /Qui écrit les accroches/ }).click()
  await page.getByRole('radio', { name: /Avec Claude Code/ }).click()

  /* La première marche dit quoi lancer, et donne la commande à copier. `exact`
     est nécessaire : la ligne d'état cite la même commande, et une recherche
     partielle ramènerait les deux. */
  await expect(page.getByText('pnpm --filter bridge run start', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Copier/ })).toBeVisible()

  /* Le pont n'est pas là, et la page l'a constaté toute seule : c'est écrit
     avant qu'on ait rien tapé, et le champ du jeton reste inerte — coller un
     secret dans un pont éteint ne peut produire qu'un échec. */
  await expect(page.getByRole('alert').filter({ hasText: 'bridge run start' })).toBeVisible()
  await expect(page.getByLabel('Jeton d’appairage')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Connecter' })).toBeHidden()
  // Et le bouton qui relit cet état est là, plutôt qu'un rechargement de page.
  await expect(page.getByRole('button', { name: 'Vérifier' })).toBeEnabled()
})

test('une clé refusée le dit, et n’est écrite nulle part', async ({ page }) => {
  await waitForApp(page)
  await page.route('https://api.anthropic.com/**', (route: Route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
  )

  await openCampaignDialog(page)
  await page.getByRole('button', { name: /Qui écrit les accroches/ }).click()
  await page.getByRole('radio', { name: /clé Anthropic/ }).click()

  const flow = page.locator('[data-slot="setup-flow"]')
  await expect(flow.getByRole('progressbar')).toHaveAttribute('max', '2')
  await expect(flow.locator('[data-state="active"], [data-state="error"]')).toHaveCount(1)

  // Une clé ne s'installe pas : la première marche est une adresse, et le champ
  // est immédiatement utilisable.
  const field = page.getByLabel('Clé d’API Anthropic')
  await expect(field).toBeEnabled()
  await field.fill('cle-factice-invalide')
  await page.getByRole('button', { name: 'Connecter' }).click()
  await expect(page.getByRole('alert')).toContainText('recopiée')
  await expect(flow.locator('[data-state="active"], [data-state="error"]')).toHaveCount(1)

  // La clé n'est écrite nulle part : ni stockage local, ni session.
  const persisted = await page.evaluate(() => {
    const dump = [
      ...Object.keys(localStorage).map((key) => localStorage.getItem(key) ?? ''),
      ...Object.keys(sessionStorage).map((key) => sessionStorage.getItem(key) ?? ''),
    ].join('\n')
    return dump.includes('cle-factice-invalide')
  })
  expect(persisted).toBe(false)

  // Et la voie recommandée reste à un clic, sans reconnexion ni redémarrage.
  await page.getByRole('radio', { name: /ScreenForge seul/ }).click()
  await page.getByRole('button', { name: 'Retour au brief' }).click()
  await page.getByLabel('Nom de l’app').fill('Cadence')
  await page.getByRole('button', { name: /^Proposer \d+ visuels?$/ }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez la proposition' })).toBeVisible()
})

test('le parcours reste contenu à largeur étroite et en mouvement réduit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('http://127.0.0.1:4590/**', (route: Route) => route.abort())

  await waitForApp(page)
  await openCampaignDialog(page)
  await page.setViewportSize({ width: 420, height: 820 })
  await page.getByRole('button', { name: /Qui écrit les accroches/ }).click()
  await page.getByRole('radio', { name: /Avec Claude Code/ }).click()

  const flow = page.locator('[data-slot="setup-flow"]')
  await expect(flow).toBeVisible()
  const rendering = await flow.evaluate((element) => ({
    contained: element.scrollWidth <= element.clientWidth,
    transition: getComputedStyle(element.querySelector('[data-slot="setup-step"]')!)
      .transitionProperty,
  }))
  expect(rendering.contained).toBe(true)
  expect(rendering.transition).not.toContain('transform')
})

/**
 * Une clé acceptée traverse le rechargement, et sait se retirer.
 *
 * Les deux moitiés comptent autant l'une que l'autre : sans la reprise, chaque
 * session recommence par un collage ; sans le retrait, la clé reste sur la
 * machine sans qu'aucun geste de l'interface ne puisse l'en sortir. Le test
 * vérifie aussi ce que la reprise ne fait **pas** — se reconnecter d'elle-même.
 *
 * Clé factice, API interceptée : rien ne sort d'ici.
 */
test('une clé acceptée est reprise au rechargement, et s’oublie sur demande', async ({ page }) => {
  const FAKE_KEY = 'sk-ant-cle-factice-acceptee'
  await page.route('https://api.anthropic.com/**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 'claude-factice', display_name: 'Claude factice' }] }),
    }),
  )

  await waitForApp(page)
  await openCampaignDialog(page)
  await page.getByRole('button', { name: /Qui écrit les accroches/ }).click()
  await page.getByRole('radio', { name: /clé Anthropic/ }).click()
  await page.getByLabel('Clé d’API Anthropic').fill(FAKE_KEY)
  await page.getByRole('button', { name: 'Connecter' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Clé acceptée' })).toBeVisible()

  await page.reload()
  await waitForApp(page)
  await openCampaignDialog(page)

  /* Le fournisseur est repris avant même qu'on déplie : le résumé de la section
     le nomme, ce qui est la seule chose visible d'un état retenu. */
  const disclosure = page.getByRole('button', { name: /Qui écrit les accroches/ })
  await expect(disclosure).toContainText('clé Anthropic')
  await disclosure.click()
  await expect(page.getByLabel('Clé d’API Anthropic')).toHaveValue(FAKE_KEY)
  await expect(
    page.getByRole('progressbar', { name: /Configuration de .*Anthropic/ }),
  ).toHaveAttribute('value', '0')

  /* Rien ne s'est reconnecté tout seul : ouvrir une fenêtre ne déclenche pas de
     requête sortante, et le modèle attend le clic. */
  await expect(page.getByRole('button', { name: 'Connecter' })).toBeEnabled()
  await expect(page.getByRole('combobox', { name: 'Modèle' })).toBeHidden()

  // Ni le stockage local ni la session ne la portent — elle est scellée ailleurs.
  const inClearStorage = await page.evaluate((key) => {
    const dump = [
      ...Object.keys(localStorage).map((entry) => localStorage.getItem(entry) ?? ''),
      ...Object.keys(sessionStorage).map((entry) => sessionStorage.getItem(entry) ?? ''),
    ].join('\n')
    return dump.includes(key)
  }, FAKE_KEY)
  expect(inClearStorage).toBe(false)

  // Et le retrait est un vrai retrait : il survit lui aussi au rechargement.
  const flow = page.locator('[data-slot="setup-flow"]')
  await page.getByRole('button', { name: 'Oublier cette clé' }).click()
  await expect(page.getByLabel('Clé d’API Anthropic')).toHaveValue('')
  await expect(flow.getByRole('progressbar')).toHaveAttribute('value', '0')
  await expect(flow).toContainText('0 sur 2')
  await expect(
    flow.locator('[data-slot="setup-step"]', { hasText: 'Collez votre clé' }),
  ).toHaveAttribute('data-state', 'active')
  await expect(
    flow.locator('[data-slot="setup-step"]', { hasText: 'Choisissez le modèle' }),
  ).toHaveAttribute('data-state', 'waiting')

  await page.reload()
  await waitForApp(page)
  await openCampaignDialog(page)
  await page.getByRole('button', { name: /Qui écrit les accroches/ }).click()
  await expect(page.getByLabel('Clé d’API Anthropic')).toHaveValue('')
})
