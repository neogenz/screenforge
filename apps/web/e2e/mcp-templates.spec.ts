import { expect, test, type Page } from '@playwright/test'
import { waitForApp } from './helpers'
import { connect, startRelay, type Relay } from './mcp-relay'

/**
 * Ce que l'agent a trouvé se garde, et se retrouve après le rechargement.
 *
 * Le lot d'un agent appartient à une fiche App Store ; la mise en page qu'il a
 * trouvée au troisième essai n'appartient à rien, et disparaissait avec le
 * projet. Ce spec vérifie le seul point qui rend la fonctionnalité vraie plutôt
 * que plausible : le gabarit est écrit sur le disque du navigateur, hors du
 * projet, donc il est encore là quand tout le reste a été rechargé.
 */

async function screenCount(page: Page): Promise<number> {
  return page.evaluate(
    () => window.__sfStores?.useProjectStore.getState().project?.screens.length ?? 0,
  )
}

async function compose(page: Page, relay: Relay): Promise<void> {
  relay.push('lot-composition', [
    { tool: 'set_background', args: { background: { type: 'solid', color: '#101114' } } },
    {
      tool: 'add_text',
      args: { content: 'Tout votre budget', x: 40, y: 90, width: 360, fontSize: 44 },
    },
    { tool: 'add_device', args: { x: 80, y: 300 } },
  ])
  await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
  expect(relay.answers[0].ok).toBe(true)
}

async function openPicker(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ouvrir les modèles' }).click()
  await expect(page.getByRole('dialog', { name: 'Modèles de mise en page' })).toBeVisible()
}

test.describe('gabarits enregistrés par l’agent', () => {
  test('un gabarit posé par l’agent s’applique et survit au rechargement', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')
      await compose(page, relay)

      relay.askSaveTemplate('gabarit-1', { name: 'Ouverture sombre' })
      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(2)
      expect(relay.answers[1].ok).toBe(true)
      expect(relay.answers[1].result?.name).toBe('Ouverture sombre')

      // Visible dans le sélecteur, sous sa propre section et marqué d'où il vient.
      await openPicker(page)
      const dialog = page.getByRole('dialog', { name: 'Modèles de mise en page' })
      await expect(dialog.getByRole('heading', { name: 'Mes gabarits' })).toBeVisible()
      const tile = dialog.getByRole('button', {
        name: 'Sélectionner le modèle Ouverture sombre',
      })
      await expect(tile).toBeVisible()
      await expect(dialog.getByText('IA', { exact: true })).toBeVisible()

      // Appliqué à un nouvel écran : de vrais calques, pas un aperçu.
      const before = await screenCount(page)
      await tile.click()
      await dialog.getByRole('button', { name: 'Nouvel écran' }).click()
      await expect.poll(() => screenCount(page)).toBe(before + 1)

      const applied = await page.evaluate(() => {
        const project = window.__sfStores?.useProjectStore.getState().project
        const screen = project?.screens.at(-1)
        return {
          types: (screen?.layers ?? []).map((layer) => layer.type),
          background: screen?.background,
        }
      })
      expect(applied.types).toEqual(['text', 'device-frame'])
      expect(applied.background).toEqual({ type: 'solid', color: '#101114' })

      // Le gabarit vit hors du projet : c'est ce que le rechargement démontre.
      await page.reload({ waitUntil: 'networkidle' })
      await waitForApp(page)
      await openPicker(page)
      await expect(
        page.getByRole('button', { name: 'Sélectionner le modèle Ouverture sombre' }),
      ).toBeVisible()
    } finally {
      await relay.stop()
    }
  })

  test('save puis list reste ordonné au démarrage et après rechargement', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')
      await compose(page, relay)

      relay.askSaveTemplate('gabarit-a', { name: 'Réutilisable' })
      relay.askListTemplates('liste-1')
      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(3)
      expect(relay.answers.find((answer) => answer.id === 'gabarit-a')?.ok).toBe(true)

      const listed =
        relay.answers.find((answer) => answer.id === 'liste-1')?.result?.templates ?? []
      expect(listed).toHaveLength(1)
      expect(listed[0].name).toBe('Réutilisable')
      expect(listed[0].source).toBe('ai')
      expect(listed[0].layerCount).toBe(2)

      const opened = relay.opened()
      await page.reload({ waitUntil: 'networkidle' })
      await waitForApp(page)
      await expect.poll(() => relay.opened(), { timeout: 10_000 }).toBeGreaterThan(opened)

      relay.askListTemplates('liste-2')
      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(4)
      const reloaded =
        relay.answers.find((answer) => answer.id === 'liste-2')?.result?.templates ?? []
      expect(reloaded.map((template) => template.name)).toEqual(['Réutilisable'])

      // Refus explicite après la relecture du disque, pas un suffixe posé dans
      // le dos de l'agent : il n'existe toujours qu'un seul gabarit de ce nom.
      relay.askSaveTemplate('gabarit-b', { name: 'Réutilisable' })
      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(5)
      const collision = relay.answers.find((answer) => answer.id === 'gabarit-b')
      expect(collision?.ok).toBe(false)
      expect(collision?.error).toMatch(/s’appelle déjà/)
    } finally {
      await relay.stop()
    }
  })

  test('l’utilisateur garde le sien depuis la pellicule, et il ne porte pas le badge IA', async ({
    page,
  }) => {
    await waitForApp(page)
    await page.locator('button[aria-label="Activer Écran 1"]').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Enregistrer comme gabarit' }).click()
    await expect(page.getByText(/Gabarit .+ enregistré/)).toBeVisible()

    await openPicker(page)
    const dialog = page.getByRole('dialog', { name: 'Modèles de mise en page' })
    await expect(dialog.getByRole('heading', { name: 'Mes gabarits' })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'Sélectionner le modèle Écran 1' }),
    ).toBeVisible()
    // Le badge dit d'où vient la mise en page : posé par une main, il n'y est pas.
    await expect(dialog.getByText('IA', { exact: true })).toHaveCount(0)
  })

  test('un écran inconnu répond par la liste de ceux qui existent', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')

      relay.askSaveTemplate('gabarit-perdu', { name: 'Nulle part', screenId: 'ecran-inexistant' })
      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(false)
      expect(relay.answers[0].error).toMatch(/ecran-inexistant/)
    } finally {
      await relay.stop()
    }
  })
})
