import { expect, test, type Page } from '@playwright/test'
import { downloadFirstExportedPng } from './helpers'
import { connect, startRelay } from './mcp-relay'

/**
 * L'agent voit ce qu'il pose, et pose des fichiers qui n'ont pas quitté le disque.
 *
 * Deux boucles se ferment ici, et aucune des deux ne pouvait être vérifiée par
 * un test unitaire : une image locale devient un vrai calque du projet ouvert
 * sans que son chemin ne traverse quoi que ce soit, et un écran composé revient
 * à l'agent en PNG — rendu par le navigateur, seul endroit où les polices
 * Google, les gabarits d'appareil et les captures existent réellement.
 *
 * Le détail qui compte, et qui n'a pas de second filet : l'identifiant qui
 * voyage n'est pas celui du projet. Le démon nomme un fichier de son coffre, la
 * page va le chercher, l'enregistre chez elle et **réécrit l'appel** avant de
 * l'appliquer. Un calque qui garderait l'identifiant du démon serait vide au
 * prochain rechargement, sans que rien ne dise pourquoi.
 */

/** Un PNG 8×4 valide : le navigateur le décode vraiment, il le mesure vraiment. */
const PNG_8x4 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAYAAACzzX7wAAAAEklEQVR4nGPQqzX6jw8z0F4BADXlO4E81RYZAAAAAElFTkSuQmCC'

async function deviceLayer(page: Page) {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    const layer = project?.screens[0]?.layers
      .filter((entry) => entry.type === 'device-frame')
      .at(-1)
    if (!layer || layer.type !== 'device-frame') return null
    return {
      assetId: layer.screenshotAssetId ?? '',
      size: layer.screenshotSize,
      /* Résolvable dans le registre de la page : c'est la seule preuve que
         l'octet est arrivé, et pas seulement son nom. */
      dataUrl: layer.screenshotAssetId
        ? (window.__sfAssets?.resolveAsset(layer.screenshotAssetId) ?? null)
        : null,
    }
  })
}

async function historyDepth(page: Page): Promise<number> {
  return page.evaluate(() => window.__sfStores?.useHistoryStore.getState().past.length ?? 0)
}

async function layerTypes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const project = window.__sfStores?.useProjectStore.getState().project
    return (project?.screens[0]?.layers ?? []).map((layer) => layer.type)
  })
}

test.describe('images et vignettes par le MCP', () => {
  test('une capture du disque devient un calque, et seul son identifiant a voyagé', async ({
    page,
  }) => {
    const relay = await startRelay()
    try {
      relay.serve('coffre-abc123', Buffer.from(PNG_8x4, 'base64'))
      await connect(page, relay)
      await page.keyboard.press('Escape')

      relay.push('lot-image', [
        {
          tool: 'add_device',
          args: {
            slot: 'ecran-1',
            assetId: 'coffre-abc123',
            screenshotWidth: 8,
            screenshotHeight: 4,
          },
        },
      ])

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(true)

      // La page est allée chercher l'octet, sur jeton, à l'identifiant nommé.
      expect(relay.claims()).toEqual(['coffre-abc123'])

      const device = await deviceLayer(page)
      expect(device).not.toBeNull()
      expect(device!.size).toEqual({ width: 8, height: 4 })
      expect(device!.dataUrl).toMatch(/^data:image\/png;base64,/)
      // Réécrit : l'identifiant du coffre ne survivrait pas au rechargement.
      expect(device!.assetId).not.toBe('coffre-abc123')

      /* Et l'export reste ce qu'Apple accepte. Une image venue du MCP n'est pas
         d'une autre nature qu'une image glissée à la souris — elle passe par le
         même `registerAsset` — mais c'est précisément ce qui doit être constaté
         plutôt que déduit : le chemin d'entrée est neuf, la sortie ne l'est pas. */
      const { png } = await downloadFirstExportedPng(page)
      const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
      expect(view.getUint32(16)).toBe(1320)
      expect(view.getUint32(20)).toBe(2868)
      expect(view.getUint8(24)).toBe(8)
      expect(view.getUint8(25)).toBe(2)
    } finally {
      await relay.stop()
    }
  })

  test('un même fichier posé deux fois n’est demandé qu’une fois', async ({ page }) => {
    const relay = await startRelay()
    try {
      relay.serve('coffre-repete', Buffer.from(PNG_8x4, 'base64'))
      await connect(page, relay)
      await page.keyboard.press('Escape')

      const args = {
        assetId: 'coffre-repete',
        originalWidth: 8,
        originalHeight: 4,
        width: 80,
        height: 40,
      }
      relay.push('lot-double', [
        { tool: 'add_image', args: { ...args, name: 'Logo' } },
        { tool: 'add_image', args: { ...args, name: 'Logo bis', x: 200 } },
      ])

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(true)
      expect(relay.claims()).toEqual(['coffre-repete'])
    } finally {
      await relay.stop()
    }
  })

  test('un identifiant que le coffre ignore refuse le lot entier', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')
      const depth = await historyDepth(page)
      const before = await layerTypes(page)

      relay.push('lot-fantome', [
        { tool: 'add_text', args: { content: 'Celui-ci passerait' } },
        {
          tool: 'add_device',
          args: { assetId: 'jamais-offert', screenshotWidth: 8, screenshotHeight: 4 },
        },
      ])

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(false)
      // Le message nomme l'image et le geste de reprise, pas « échec ».
      expect(relay.answers[0].error).toMatch(/jamais-offert/)
      expect(relay.answers[0].error).toMatch(/screenforge_add_image/)

      // Rien de posé, pas même le premier appel, qui était valide.
      expect(await layerTypes(page)).toEqual(before)
      expect(await historyDepth(page)).toBe(depth)
    } finally {
      await relay.stop()
    }
  })

  test('la vignette rend l’écran demandé sans rien écrire dans le projet', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')
      const depth = await historyDepth(page)

      const screenId = await page.evaluate(
        () => window.__sfStores?.useProjectStore.getState().project?.screens[0]?.id ?? '',
      )
      relay.askRender('vignette-1', { screenId, maxWidth: 400 })

      await expect.poll(() => relay.answers.length, { timeout: 20_000 }).toBe(1)
      const answer = relay.answers[0]
      expect(answer.ok).toBe(true)
      expect(answer.result?.screenId).toBe(screenId)
      expect(answer.result?.width).toBe(400)

      // Un vrai PNG, à la largeur demandée : c'est ce que l'agent regardera.
      const png = Buffer.from(answer.result?.data ?? '', 'base64')
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      expect(png.readUInt32BE(16)).toBe(400)
      expect(png.readUInt32BE(20)).toBe(answer.result?.height)

      // Lire n'est pas écrire : regarder son travail ne doit pas coûter à
      // l'utilisateur un pas d'annulation par coup d'œil de l'agent.
      expect(await historyDepth(page)).toBe(depth)
    } finally {
      await relay.stop()
    }
  })

  test('un écran inconnu répond par la liste de ceux qui existent', async ({ page }) => {
    const relay = await startRelay()
    try {
      await connect(page, relay)
      await page.keyboard.press('Escape')

      relay.askRender('vignette-perdue', { screenId: 'ecran-inexistant' })

      await expect.poll(() => relay.answers.length, { timeout: 10_000 }).toBe(1)
      expect(relay.answers[0].ok).toBe(false)
      expect(relay.answers[0].error).toMatch(/ecran-inexistant/)
      expect(relay.answers[0].error).toMatch(/Écrans du projet/)
    } finally {
      await relay.stop()
    }
  })
})
