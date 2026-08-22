import { expect, test, type Page } from '@playwright/test'
import { addTextLayer, utilitiesTrigger, waitForApp } from './helpers'

interface LayerEntryProbe {
  duration: string
  name: string
}

type MotionProbeWindow = Window & {
  __sfLayerEntryProbe?: LayerEntryProbe
  __sfExitProbe?: LayerEntryProbe
}

async function armLayerEntryProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = window as MotionProbeWindow
    root.__sfLayerEntryProbe = undefined
    const capture = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.dataset.layerId) return
      const style = getComputedStyle(event.target)
      root.__sfLayerEntryProbe = { name: event.animationName, duration: style.animationDuration }
      document.removeEventListener('animationstart', capture)
    }
    document.addEventListener('animationstart', capture)
  })
}

/**
 * Capture la première animation lancée par un `[role="dialog"]` qui sort.
 *
 * Armée avant l'ouverture : la sortie est trop courte pour être relue.
 */
async function armExitProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = window as MotionProbeWindow
    root.__sfExitProbe = undefined
    const capture = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement)) return
      if (event.target.dataset.state !== 'closed') return
      const style = getComputedStyle(event.target)
      root.__sfExitProbe = { name: event.animationName, duration: style.animationDuration }
      document.removeEventListener('animationstart', capture)
    }
    document.addEventListener('animationstart', capture)
  })
}

function readExitProbe(page: Page): Promise<LayerEntryProbe | null> {
  return page.evaluate(
    () => (window as MotionProbeWindow).__sfExitProbe ?? null,
  ) as Promise<LayerEntryProbe | null>
}

function readLayerEntryProbe(page: Page): Promise<LayerEntryProbe | null> {
  return page.evaluate(
    () => (window as MotionProbeWindow).__sfLayerEntryProbe ?? null,
  ) as Promise<LayerEntryProbe | null>
}

/**
 * Les micro-interactions restent dans leur couloir, et s'effacent à demande.
 *
 * Deux garanties mesurables, pas deux goûts : aucune animation ajoutée ne
 * dépasse 300 ms, et `prefers-reduced-motion: reduce` les rend toutes
 * instantanées — entrées de lignes, vignettes, coche dessinée des toasts.
 */

test.describe('micro-interactions', () => {
  test('les entrées de lignes restent sous 300 ms', async ({ page }) => {
    await waitForApp(page)
    await armLayerEntryProbe(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    await expect.poll(() => readLayerEntryProbe(page)).not.toBeNull()
    const timing = await readLayerEntryProbe(page)
    expect(timing?.name).toBe('enter')
    expect(Number.parseFloat(timing?.duration ?? 'Infinity')).toBeLessThanOrEqual(0.3)
  })

  test('reduced motion rend les entrées instantanées', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await waitForApp(page)
    await armLayerEntryProbe(page)
    await addTextLayer(page)
    const layersOpen = await page.evaluate(
      () => window.__sfStores?.useUIStore.getState().layersOpen,
    )
    if (!layersOpen)
      await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())

    /* Sous `reduce`, les entrées animées retombent sur le simple fondu : plus
       de translation, plus de settle. */
    await expect.poll(async () => (await readLayerEntryProbe(page))?.name).toBe('fade-in')
  })

  /* Une action clavier répétée des dizaines de fois par jour ne se regarde pas
     arriver : la palette est là, ou elle n'est pas là. */
  test('la palette n’anime ni son voile ni son contenu', async ({ page }) => {
    await waitForApp(page)
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.locator('[cmdk-root]')).toBeVisible()

    const running = await page.evaluate(() =>
      [...document.querySelectorAll('[cmdk-dialog], [cmdk-root], [cmdk-overlay]')].reduce(
        (total, element) => total + element.getAnimations().length,
        0,
      ),
    )
    expect(running).toBe(0)
  })

  /* Une sortie aussi longue que l'entrée fait attendre à chaque Échap ; une
     disparition sèche se lit comme un plantage.

     Mesurée par `animationstart` et non en relisant l'élément après coup :
     la sortie dure 100 ms, Radix démonte à la dernière image, et un
     aller-retour Playwright arrive après. Le seul instant où l'animation
     existe est celui où elle commence.

     Le menu et non un dialogue : `Presence` ne peut jouer une sortie que si
     la racine Radix reste montée le temps de la jouer, et chaque hôte de
     dialogue rend `null` sur son drapeau de store — délibérément, pour que
     l'abonnement au projet ne vive que boîte ouverte. `dialog.tsx` porte la
     classe de sortie, elle prendra effet le jour où un hôte gardera sa
     racine. */
  test('un menu sort plus vite qu’il n’entre', async ({ page }) => {
    await waitForApp(page)
    await armExitProbe(page)
    await utilitiesTrigger(page).click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()

    const exit = await readExitProbe(page)
    expect(exit, 'aucune animation de sortie').not.toBeNull()
    expect(exit?.name).toBe('exit-fast')
    // Entrée à 160 ms (`menu-in`) : la sortie ne la rattrape jamais.
    expect(Number.parseFloat(exit?.duration ?? 'Infinity')).toBeLessThanOrEqual(0.12)
  })

  /* Un bouton qui ne bouge pas sous le doigt paraît sourd : c'est la seule
     confirmation que le clic a été reçu avant que l'action n'aboutisse. */
  test('un bouton pressé se réduit, et pas sous reduced motion', async ({ page }) => {
    await waitForApp(page)
    // Un `Button`, donc 0,97 : `IconButton` descend à 0,96, un carré de 32px
    // se réduisant de moins d'un pixel à 0,97.
    const exportButton = page.locator('button[aria-label="Ouvrir l’export"]')
    const box = await exportButton.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    /* `scale` et non `transform` : c'est la propriété que Tailwind v4 écrit
       pour `scale-*`, et `transform` reste à `none`. La valeur est attendue
       plutôt que lue d'un coup — la transition de 120 ms est encore en vol au
       moment du `mousedown`. */
    await page.mouse.down()
    await expect
      .poll(() => exportButton.evaluate((element) => getComputedStyle(element).scale))
      .toBe('0.97')
    await page.mouse.up()

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.mouse.down()
    const still = await exportButton.evaluate((element) => getComputedStyle(element).scale)
    await page.mouse.up()
    expect(still).toBe('none')
  })

  test('la coche de succès se dessine, et reste pleine sous reduced motion', async ({ page }) => {
    await waitForApp(page)
    await page.evaluate(async () => {
      const toastPath = '/src/stores/toast.store.ts'
      const { toast } = (await import(toastPath)) as typeof import('../src/stores/toast.store')
      toast('Exporté.', 'success')
    })
    const check = page.locator('[data-sonner-toast] svg path.animate-check-draw')
    await expect(check).toBeVisible()

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect
      .poll(() => check.evaluate((element) => getComputedStyle(element).strokeDashoffset))
      .toBe('0px')
  })
})
