import { expect, test, type Page } from '@playwright/test'
import { waitForApp } from './helpers'
import { connect, startRelay, TOKEN } from './mcp-relay'

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

test.describe('connexion MCP', () => {
  test('un lot de l’agent vaut une écriture et une seule annulation', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)

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

      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByRole('button', { name: 'Désactiver' }).click()
      await expect(dialog.getByRole('status')).toHaveText('Inactive')

      // Coupé, et qui le reste : le client réessaie tout seul quand un flux
      // tombe, et un « Désactiver » qui laisserait ce ressort armé rouvrirait
      // la porte quinze secondes plus tard.
      await expect.poll(() => relay.live(), { timeout: 10_000 }).toBe(0)
      await page.waitForTimeout(2500)
      expect(relay.live()).toBe(0)
      await expect(dialog.getByRole('button', { name: 'Activer' })).toBeVisible()
    } finally {
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

      await page.getByRole('button', { name: 'Connexion MCP' }).click()
      const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
      await dialog.getByRole('button', { name: 'Activer' }).click()
      await expect(dialog.getByRole('status')).toHaveText('Connectée')
      expect(relay.opened()).toBe(1)

      // Le choix est mémorisé, le jeton non : la reprise repasse par /pair.
      await page.reload({ waitUntil: 'networkidle' })
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

  test('sans démon, le mode se propose quand même et dit quoi lancer', async ({ page }) => {
    // Un port libre sur lequel personne n'écoute : c'est le cas normal, pas une
    // panne, et la page doit le nommer plutôt que rester sur « Connexion… ».
    const relay = await startRelay()
    const port = relay.port
    await relay.stop()

    await page.addInitScript((closed: number) => {
      localStorage.setItem('screenforge-mcp-port', String(closed))
    }, port)
    await waitForApp(page)

    await page.getByRole('button', { name: 'Connexion MCP' }).click()
    const dialog = page.getByRole('dialog', { name: 'Connexion MCP' })
    await dialog.getByRole('button', { name: 'Activer' }).click()
    await expect(dialog.getByRole('status')).toHaveText('Injoignable')
    await expect(dialog.getByText(/pnpm --filter mcp run start/)).toBeVisible()
  })
})
