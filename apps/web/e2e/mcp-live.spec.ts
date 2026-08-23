import { expect, test, type Locator, type Page } from '@playwright/test'
import { expectNoRawIcon, openUtility, waitForApp } from './helpers'
import { connect, startRelay, TOKEN } from './mcp-relay'

const PNG_8x4 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAEklEQVR4nGPQqzX6jw8z0F4BADXlO4E81RYZAAAAAElFTkSuQmCC'

/**
 * L'agent conduit l'éditeur ouvert, et ce qu'il pose s'annule d'un geste.
 *
 * Le relais est un vrai serveur HTTP tenu par le test — voir `mcp-relay.ts`,
 * qui dit pourquoi il ne peut pas être un `page.route`.
 */

async function layerTypes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    return (project?.screens[0]?.layers ?? []).map((layer) => layer.type)
  })
}

async function historyDepth(page: Page): Promise<number> {
  return page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? 0)
}

async function expectConnectionFlow(dialog: Locator, completed: number) {
  const flow = dialog.locator('[data-slot="setup-flow"]')
  await expect(flow.locator('[data-slot="setup-step"]')).toHaveCount(4)
  await expect(flow.getByRole('progressbar')).toHaveAttribute('value', String(completed))
  await expect(flow.locator('[data-state="active"], [data-state="error"]')).toHaveCount(1)
}

test.describe('connexion MCP', () => {
  test('le code faux reste générique et le parcours complet fonctionne au clavier', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      await page.addInitScript((port: number) => {
        localStorage.setItem('screenforge-mcp-port', String(port))
      }, relay.port)
      await waitForApp(page)
      await openUtility(page, 'Connexion MCP')
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      // Avant tout appairage, la version ne vient que de la sonde — et les
      // détails la lisent au même endroit que la marche 1. Les faire lire le
      // store seul écrivait « Non détectée » sous une marche qui venait
      // d'annoncer le démon joignable : deux affirmations contradictoires sur
      // le même écran.
      await dialog.getByText('Détails de connexion').click()
      await expect(dialog.getByText('MCP 0.1.0-test', { exact: true })).toBeVisible()
      await expect(dialog.getByText('Non détectée')).toHaveCount(0)
      await dialog.getByText('Détails de connexion').click()

      const code = dialog.getByLabel('Code d’appairage')
      const pair = dialog.getByRole('button', { name: 'Appairer' })
      await code.fill('000000')
      await pair.focus()
      await page.keyboard.press('Enter')
      await expect(dialog.getByRole('alert')).toHaveText(
        'Code invalide, expiré ou temporairement bloqué.',
      )
      await expect(code).toBeFocused()

      await code.fill(relay.code())
      await pair.focus()
      await page.keyboard.press('Enter')
      const disable = dialog.getByRole('button', { name: 'Désactiver' })
      await expect(disable).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(dialog.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Inactive',
      )
      await expect(code).toBeFocused()
    } finally {
      await relay.stop()
    }
  })

  test('une coupure transitoire reprend le bearer du même onglet sans nouveau code', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      expect(relay.opened()).toBe(1)
      relay.dropStream()
      await expect.poll(() => relay.opened(), { timeout: 10_000 }).toBe(2)
      await expect(
        page
          .getByRole('dialog', { name: 'Connexion MCP' })
          .getByRole('status', { name: 'État de la connexion' }),
      ).toHaveText('Connectée')
    } finally {
      await relay.stop()
    }
  })

  test('un lot de l’agent vaut une écriture et une seule annulation', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await expectConnectionFlow(dialog, 4)
      await dialog.getByText('Détails de connexion').click()
      // Exact : la première marche annonce désormais elle aussi la version
      // constatée, et « MCP 0.1.0-test » s'y lit à l'intérieur d'une phrase.
      await expect(dialog.getByText('MCP 0.1.0-test', { exact: true })).toBeVisible()
      await expect(dialog.getByText(/127\.0\.0\.1:\d+ · loopback/)).toBeVisible()
      await expect(dialog.getByText(/miniature rendue/)).toBeVisible()

      // L'état part sans qu'on le demande : un agent qui lit avant d'agir ne
      // doit pas payer un aller-retour pour ce que la page connaît déjà.
      await expect.poll(() => relay.states.length).toBeGreaterThan(0)
      expect(JSON.stringify(relay.states[0])).not.toContain('data:image')

      await page.keyboard.press('Escape')

      const before = await layerTypes(page)
      const depth = await historyDepth(page)

      relay.push('lot-1', [
        {
          tool: 'set_background',
          args: {
            background: {
              type: 'linear-gradient',
              angle: 135,
              stops: [
                { offset: 0, color: '#101114' },
                { offset: 1, color: '#3b2f7a' },
              ],
            },
          },
        },
        {
          tool: 'add_text',
          args: {
            content: 'Composé par l’agent',
            x: 60,
            y: 120,
            width: 1200,
            fontSize: 96,
            color: '#ffffff',
          },
        },
        { tool: 'add_device', args: { slot: 'ecran-1', x: 200, y: 700 } },
      ])

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].id).toBe('lot-1')
      expect(relay.answers[0].ok).toBe(true)
      expect(relay.answers[0].result?.layerIds).toHaveLength(2)

      // De vrais calques dans le projet ouvert, pas un aperçu.
      expect(await layerTypes(page)).toEqual([...before, 'text', 'device-frame'])
      const background = await page.evaluate(
        () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.background.type,
      )
      expect(background).toBe('linear-gradient')

      // Trois appels, un pas d'annulation — sans quoi défaire coûterait autant
      // de ⌘Z que l'agent a passé d'appels, ce qui revient à ne pas défaire.
      expect(await historyDepth(page)).toBe(depth + 1)
      await page.keyboard.press('ControlOrMeta+z')
      await expect.poll(() => layerTypes(page)).toEqual(before)

      // L'état est repoussé après l'écriture : l'agent voit ce qu'il a fait.
      await expect.poll(() => relay.states.length).toBeGreaterThan(1)

      await openUtility(page, 'Connexion MCP')
      const reopened = page.getByRole('dialog', { name: 'Connexion MCP' })
      await reopened.getByText('Détails de connexion').click()
      await expect(reopened.getByText('1 lot · 3 appels')).toBeVisible()
    } finally {
      await relay.stop()
    }
  })

  test('un appel hors catalogue ne touche pas le projet et revient au validateur', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')
      const before = await layerTypes(page)
      const depth = await historyDepth(page)

      relay.push('lot-2', [
        { tool: 'add_text', args: { content: 'Celui-ci passerait' } },
        { tool: 'add_device', args: { deviceModel: 'pixel-9-pro' } },
      ])

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(false)
      // Le message nomme la cause, pas seulement le refus.
      expect(relay.answers[0].error).toMatch(/deviceModel.+hors catalogue/)

      // Le premier appel du lot était valide : il ne reste rien de lui non plus.
      expect(await layerTypes(page)).toEqual(before)
      expect(await historyDepth(page)).toBe(depth)
    } finally {
      await relay.stop()
    }
  })

  test('désactiver coupe le flux et ne le rouvre pas', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      expect(relay.live()).toBe(1)

      let dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByRole('button', { name: 'Fermer' }).click()
      await expect(dialog).toBeHidden()
      expect(relay.live()).toBe(1)

      await openUtility(page, 'Connexion MCP')
      dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByRole('button', { name: 'Désactiver' }).click()
      await expect(dialog.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Inactive',
      )

      // Coupé, et qui le reste : le client réessaie tout seul quand un flux
      // tombe, et un « Désactiver » qui laisserait ce ressort armé rouvrirait
      // la porte quinze secondes plus tard.
      await expect.poll(() => relay.live(), { timeout: 10_000 }).toBe(0)
      await page.waitForTimeout(2500)
      expect(relay.live()).toBe(0)
      await expect(dialog.getByRole('button', { name: 'Appairer' })).toBeVisible()
    } finally {
      await relay.stop()
    }
  })

  test('désactiver pendant un asset retardé interdit toute mutation tardive', async ({ page }) => {
    const relay = await startRelay()
    let releaseAsset = () => {}
    let markRequested = () => {}
    const held = new Promise<void>((resolve) => {
      releaseAsset = resolve
    })
    const requested = new Promise<void>((resolve) => {
      markRequested = resolve
    })
    try {
      relay.serve('coffre-retarde', Buffer.from(PNG_8x4, 'base64'))
      await page.route('**/asset/coffre-retarde', async (route) => {
        markRequested()
        await held
        try {
          await route.continue()
        } catch {
          // La désactivation annule précisément cette requête.
        }
      })
      await connect(page, relay)

      const before = await layerTypes(page)
      const depth = await historyDepth(page)
      relay.push('lot-retarde', [
        {
          tool: 'add_image',
          args: {
            assetId: 'coffre-retarde',
            originalWidth: 8,
            originalHeight: 4,
            width: 80,
            height: 40,
          },
        },
      ])
      await requested

      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByRole('button', { name: 'Désactiver' }).click()
      releaseAsset()

      await expect(dialog.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Inactive',
      )
      await expect.poll(() => relay.live(), { timeout: 10_000 }).toBe(0)
      await page.waitForTimeout(500)
      expect(await layerTypes(page)).toEqual(before)
      expect(await historyDepth(page)).toBe(depth)
      expect(relay.answers).toHaveLength(0)
      expect(relay.opened()).toBe(1)
    } finally {
      releaseAsset()
      await relay.stop()
    }
  })

  test('le mode ne se rallume qu’après avoir été demandé, puis survit au rechargement', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      await page.addInitScript((port: number) => {
        localStorage.setItem('screenforge-mcp-port', String(port))
      }, relay.port)
      await waitForApp(page)

      // Rien n'est sorti de l'onglet : ouvrir l'application n'appaire pas.
      await page.waitForTimeout(1500)
      expect(relay.opened()).toBe(0)

      await openUtility(page, 'Connexion MCP')
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByLabel('Code d’appairage').fill(relay.code())
      await dialog.getByRole('button', { name: 'Appairer' }).click()
      await expect(dialog.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Connectée',
      )
      expect(relay.opened()).toBe(1)

      // Le choix est mémorisé, le jeton non : la reprise exige le nouveau code.
      await page.reload({ waitUntil: 'networkidle' })
      await expect.poll(() => relay.opened(), { timeout: 10_000 }).toBe(1)
      await openUtility(page, 'Connexion MCP')
      const resumed = page.getByRole('dialog', { name: 'Connexion MCP' })
      // Le mode est mémorisé, la liaison non — et la boîte ne prétend pas
      // l'inverse : elle n'annonce ni « Connectée » ni une panne, elle
      // redemande le code en disant où il s'affiche. Auparavant la reprise
      // posait une erreur « Injoignable » sans avoir rien sondé.
      await expect(resumed.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Inactive',
      )
      await expect(resumed.getByText(/Code d’appairage ScreenForge/)).toBeVisible()
      await resumed.getByLabel('Code d’appairage').fill(relay.code())
      await resumed.getByRole('button', { name: 'Appairer' }).click()
      await expect(resumed.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Connectée',
      )
      await expect.poll(() => relay.opened(), { timeout: 10_000 }).toBe(2)
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('screenforge-mcp')))
        .toBe('1')
      expect(
        await page.evaluate(
          (token) =>
            Object.keys(localStorage).some((key) => localStorage.getItem(key)?.includes(token)),
          TOKEN,
        ),
      ).toBe(false)
    } finally {
      await relay.stop()
    }
  })

  test('une socket qui accepte et se tait laisse quand même une sortie', async ({ page }) => {
    // Un port fermé rejette tout de suite ; celui-ci accepte la connexion et ne
    // répond jamais. Sans borne côté page, la sonde restait en suspens, la
    // marche 1 sur « Connexion… » et « Vérifier » relançait la même attente :
    // la boîte n'avait plus aucune sortie.
    const relay = await startRelay()
    try {
      relay.holdHello(true)
      await page.addInitScript((port: number) => {
        localStorage.setItem('screenforge-mcp-port', String(port))
      }, relay.port)
      await waitForApp(page)

      await openUtility(page, 'Connexion MCP')
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })

      // Plus long que la borne de la sonde : c'est elle qu'on mesure.
      await expect(dialog.getByRole('alert')).toContainText(/Le démon ne répond pas/, {
        timeout: 8000,
      })
      await expectConnectionFlow(dialog, 0)

      // La sortie, et pas seulement le verdict : ce qu'on vient chercher est la
      // commande à lancer, et le bouton qui relira l'état après l'avoir lancée.
      await expect(dialog.getByText('pnpm --filter mcp run start')).toBeVisible()
      await expect(dialog.getByRole('button', { name: /^Copier/ })).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Vérifier' })).toBeEnabled()

      // Et le démon retrouvé, « Vérifier » relit l'état plutôt que de faire
      // recharger la page.
      relay.holdHello(false)
      await dialog.getByRole('button', { name: 'Vérifier' }).click()
      await expectConnectionFlow(dialog, 1)
    } finally {
      await relay.stop()
    }
  })

  test('deux vérifications qui se croisent affichent la dernière, jamais la plus ancienne', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      /* La sonde est retenue au niveau de la route et non du relais : une
         réponse tenue par un vrai serveur immobilise sa socket, et le navigateur
         met alors la sonde suivante en file derrière elle — mesuré, les deux
         partaient à trente millisecondes d'écart et revenaient dans l'ordre.
         Interceptée ici, la première ne touche jamais le réseau, donc la seconde
         part vraiment en parallèle et revient la première. */
      let release: (() => void) | undefined
      let holdNext = false
      let held = 0
      /* La boîte s'ouvre sur un démon absent : c'est l'état où « Vérifier »
         existe, puisque la marche franchie replie son contenu. */
      let answering = false
      await page.route('**/hello', async (route) => {
        if (holdNext) {
          // Une seule, désignée par le test : `StrictMode` monte l'effet deux
          // fois, donc compter les requêtes depuis l'ouverture désignerait la
          // mauvaise.
          holdNext = false
          held += 1
          await new Promise<void>((resolve) => {
            release = resolve
          })
          await route.fulfill({ status: 503, body: '' })
          return
        }
        if (answering) await route.continue()
        else await route.fulfill({ status: 503, body: '' })
      })

      await page.addInitScript((port: number) => {
        localStorage.setItem('screenforge-mcp-port', String(port))
      }, relay.port)
      await waitForApp(page)
      await openUtility(page, 'Connexion MCP')
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await expectConnectionFlow(dialog, 0)

      const check = dialog.getByRole('button', { name: 'Vérifier' })
      // La sonde retenue — c'est elle qui reviendra périmée, en échec.
      holdNext = true
      await check.click()
      await expect.poll(() => held).toBe(1)
      // Et celle qui répond tout de suite : c'est elle qui doit être affichée.
      answering = true
      await check.click()
      await expectConnectionFlow(dialog, 1)
      await expect(dialog.getByText(/Code d’appairage ScreenForge/)).toBeVisible()

      // La sonde partie plus tôt revient enfin, et ne repeint rien.
      release?.()
      await page.waitForTimeout(1000)
      await expectConnectionFlow(dialog, 1)
      await expect(dialog.getByRole('alert')).toHaveCount(0)
    } finally {
      await relay.stop()
    }
  })

  test('sans démon, le mode se propose quand même et dit quoi lancer', async ({ page }) => {
    // Un port libre sur lequel personne n'écoute : c'est le cas normal, pas une
    // panne, et la page doit le nommer plutôt que rester sur « Connexion… ».
    const relay = await startRelay()
    const port = relay.port
    await relay.stop()
    let recovered: Awaited<ReturnType<typeof startRelay>> | undefined

    try {
      await page.addInitScript((closed: number) => {
        localStorage.setItem('screenforge-mcp-port', String(closed))
      }, port)
      await waitForApp(page)

      await openUtility(page, 'Connexion MCP')
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })

      // Constaté, pas déduit d'un échec : la boîte sonde le démon en s'ouvrant,
      // et le dit avant qu'on ait tapé quoi que ce soit. La commande, elle, est
      // là dans tous les cas — c'est ce qu'on vient chercher en premier.
      await expect(dialog.getByText('pnpm --filter mcp run start')).toBeVisible()
      await expect(dialog.getByRole('alert')).toContainText(/Le démon ne répond pas/)
      // La garde ne voit que ce qu'un scénario a ouvert, et l'icône de cette
      // ligne d'alerte n'existe que dans cet état-là.
      await expectNoRawIcon(page)
      await expectConnectionFlow(dialog, 0)
      // Et tant que personne n'écoute, le code n'est pas réclamé : le champ
      // n'appartient qu'à la marche suivante, qui n'est pas ouverte.
      await expect(dialog.getByLabel('Code d’appairage')).toHaveCount(0)

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
      const copy = dialog.getByRole('button', { name: /^Copier/ })
      await copy.click()
      await expect(copy).toContainText('Copié')

      await page.setViewportSize({ width: 375, height: 800 })
      expect(
        await dialog
          .locator('[data-slot="setup-flow"]')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true)

      // Le bouton relit l'état de la machine plutôt que de faire recharger la
      // page : le démon lancé entre-temps est trouvé, et la marche s'ouvre.
      recovered = await startRelay(port)
      await dialog.getByRole('button', { name: 'Vérifier' }).click()
      await expectConnectionFlow(dialog, 1)
      await expect(dialog.getByText(/Code d’appairage ScreenForge/)).toBeVisible()

      await dialog.getByLabel('Code d’appairage').fill(recovered.code())
      await dialog.getByRole('button', { name: 'Appairer' }).click()
      await expect(dialog.getByRole('status', { name: 'État de la connexion' })).toHaveText(
        'Connectée',
      )
      await expectConnectionFlow(dialog, 4)
    } finally {
      await recovered?.stop()
    }
  })
})
