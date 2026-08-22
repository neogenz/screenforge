import { expect, test, type Page } from '@playwright/test'
import { addTextLayer, utilitiesTrigger, waitForApp } from './helpers'

interface LayerEntryProbe {
  duration: string
  name: string
}

type MotionProbeWindow = Window & {
  __sfLayerEntryProbe?: LayerEntryProbe
  __sfExitProbe?: LayerEntryProbe
  __sfToastAnims?: { name: string }[]
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
      // Base UI marque la sortie par `data-ending-style`, pas `data-state`.
      if (!('endingStyle' in event.target.dataset)) return
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
 * Chaque toast monte un nœud neuf (Sonner ne réutilise le sien qu'à `id`
 * identique, jamais fourni ici) : c'est le nom du `@keyframes` qui prouve
 * l'alternance odd/even, pas une inspection de classe.
 */
async function armToastAnimProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const root = window as MotionProbeWindow
    root.__sfToastAnims = []
    document.addEventListener('animationstart', (event) => {
      if (!(event.target instanceof HTMLElement)) return
      if (!event.target.closest('[data-sonner-toast]')) return
      if (!event.animationName.startsWith('toast-')) return
      root.__sfToastAnims!.push({ name: event.animationName })
    })
  })
}

function readToastAnims(page: Page): Promise<{ name: string }[]> {
  return page.evaluate(() => (window as MotionProbeWindow).__sfToastAnims ?? [])
}

/**
 * Le texte du `@keyframes` nommé déclare-t-il cette propriété — plutôt que
 * deviner sur une valeur mi-vol d'une animation de 320 ms, ce qui serait
 * hasardeux à relire par un aller-retour Playwright.
 */
function keyframeAnimates(page: Page, name: string, property: string): Promise<boolean> {
  return page.evaluate(
    ({ name, property }) => {
      function* walk(rules: Iterable<CSSRule>): Generator<CSSRule> {
        for (const rule of rules) {
          yield rule
          if ('cssRules' in rule) yield* walk((rule as CSSGroupingRule).cssRules)
        }
      }
      for (const sheet of document.styleSheets) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of walk(rules)) {
          if (rule instanceof CSSKeyframesRule && rule.name === name) {
            return [...rule.cssRules].some(
              (frame) =>
                frame instanceof CSSKeyframeRule && frame.style.getPropertyValue(property) !== '',
            )
          }
        }
      }
      return false
    },
    { name, property },
  )
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
    await expect(page.locator('[data-slot="command-dialog-popup"]')).toBeVisible()

    const running = await page.evaluate(() =>
      [
        ...document.querySelectorAll('[data-slot^="command-dialog-"], [data-slot="command"]'),
      ].reduce((total, element) => total + element.getAnimations().length, 0),
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

  /* Deux signatures physiques, pas deux goûts : le succès confirme (`scale`),
     l'erreur alerte (`translate`) — la propriété que joue chaque keyframe le
     dit, indépendamment de ce que Sonner nomme sa classe. */
  test('le toast de succès porte une animation scale, celui d’erreur une translate', async ({
    page,
  }) => {
    await waitForApp(page)
    await armToastAnimProbe(page)
    await page.evaluate(async () => {
      const toastPath = '/src/stores/toast.store.ts'
      const { toast } = (await import(toastPath)) as typeof import('../src/stores/toast.store')
      toast('Exporté', 'success')
      toast('Le rendu a échoué.', 'error')
    })

    await expect.poll(async () => (await readToastAnims(page)).length).toBeGreaterThanOrEqual(2)
    const anims = await readToastAnims(page)
    const success = anims.find((anim) => anim.name.startsWith('toast-success-'))
    const error = anims.find((anim) => anim.name.startsWith('toast-error-'))
    expect(success, 'animation de succès absente').toBeTruthy()
    expect(error, 'animation d’erreur absente').toBeTruthy()
    expect(await keyframeAnimates(page, success!.name, 'scale')).toBe(true)
    expect(await keyframeAnimates(page, error!.name, 'translate')).toBe(true)
  })

  /* Sonner monte un nœud par appel, jamais le même : la classe qui alterne
     est ce qui garantit qu'un `animationstart` reparte bel et bien de zéro
     pour le second toast, identique au premier, plutôt que de dépendre d'un
     navigateur qui déciderait de fusionner deux animations au nom égal. */
  test('deux toasts de succès identiques d’affilée rejouent : les classes odd/even alternent', async ({
    page,
  }) => {
    await waitForApp(page)
    await armToastAnimProbe(page)
    await page.evaluate(async () => {
      const toastPath = '/src/stores/toast.store.ts'
      const { toast } = (await import(toastPath)) as typeof import('../src/stores/toast.store')
      toast('Enregistré', 'success')
      toast('Enregistré', 'success')
    })

    await expect.poll(async () => (await readToastAnims(page)).length).toBeGreaterThanOrEqual(2)
    const [first, second] = await readToastAnims(page)
    expect(first?.name).toBe('toast-success-odd')
    expect(second?.name).toBe('toast-success-even')
  })

  test('reduced motion efface les animations de toast', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await waitForApp(page)
    await page.evaluate(async () => {
      const toastPath = '/src/stores/toast.store.ts'
      const { toast } = (await import(toastPath)) as typeof import('../src/stores/toast.store')
      toast('Exporté', 'success')
    })

    const toastEl = page.locator('[data-sonner-toast]').first()
    await expect(toastEl).toBeVisible()
    await expect
      .poll(() => toastEl.evaluate((element) => getComputedStyle(element).animationName))
      .toBe('none')
  })

  /* L'aperçu d'une vignette arrive par la netteté quand l'écran neuf reçoit
     son premier rendu — armé avant `waitForApp` pour ne pas manquer une
     arrivée automatique, plus rapide que l'aller-retour Playwright. Le
     `<img>` n'existe pas tant que `screen.thumbnail` est absent (squelette à
     sa place) : son premier rendu EST sa création dans le DOM, donc
     l'animation joue à l'insertion, une fois, jamais au re-rendu suivant. */
  test('la vignette d’un écran s’anime une fois à l’arrivée de son aperçu', async ({ page }) => {
    await page.addInitScript(() => {
      const root = window as MotionProbeWindow & {
        __sfThumbnailProbe?: { count: number } & LayerEntryProbe
      }
      root.__sfThumbnailProbe = { count: 0, name: '', duration: '' }
      document.addEventListener('animationstart', (event) => {
        if (!(event.target instanceof HTMLImageElement)) return
        if (!event.target.closest('[data-thumbnail-preview]')) return
        const style = getComputedStyle(event.target)
        root.__sfThumbnailProbe!.count += 1
        root.__sfThumbnailProbe!.name = event.animationName
        root.__sfThumbnailProbe!.duration = style.animationDuration
      })
    })
    await waitForApp(page)

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as MotionProbeWindow & { __sfThumbnailProbe?: { count: number } })
              .__sfThumbnailProbe?.count ?? 0,
        ),
      )
      .toBeGreaterThan(0)
    const probe = await page.evaluate(
      () =>
        (window as MotionProbeWindow & { __sfThumbnailProbe?: { count: number } & LayerEntryProbe })
          .__sfThumbnailProbe,
    )
    expect(probe?.name).toBe('oa-arrive')
    expect(probe?.count).toBe(1)

    // Un re-rendu sans nouveau thumbnail (ouvrir un tiroir) ne rejoue rien.
    await page.evaluate(() => window.__sfStores?.useUIStore.getState().toggleLayers())
    await page.waitForTimeout(400)
    const after = await page.evaluate(
      () =>
        (window as MotionProbeWindow & { __sfThumbnailProbe?: { count: number } })
          .__sfThumbnailProbe?.count,
    )
    expect(after).toBe(1)
  })

  test('reduced motion retombe sur un fondu pour l’arrivée d’une vignette', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      const root = window as MotionProbeWindow & {
        __sfThumbnailProbe?: { count: number } & LayerEntryProbe
      }
      root.__sfThumbnailProbe = { count: 0, name: '', duration: '' }
      document.addEventListener('animationstart', (event) => {
        if (!(event.target instanceof HTMLImageElement)) return
        if (!event.target.closest('[data-thumbnail-preview]')) return
        const style = getComputedStyle(event.target)
        root.__sfThumbnailProbe!.count += 1
        root.__sfThumbnailProbe!.name = event.animationName
        root.__sfThumbnailProbe!.duration = style.animationDuration
      })
    })
    await waitForApp(page)

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as MotionProbeWindow & { __sfThumbnailProbe?: { count: number } })
              .__sfThumbnailProbe?.count ?? 0,
        ),
      )
      .toBeGreaterThan(0)
    const probe = await page.evaluate(
      () =>
        (window as MotionProbeWindow & { __sfThumbnailProbe?: { count: number } & LayerEntryProbe })
          .__sfThumbnailProbe,
    )
    // Absent au sens du nom : `oa-arrive` ne joue jamais, `motion.css` le
    // retombe sur `fade-in` sous `prefers-reduced-motion`.
    expect(probe?.name).toBe('fade-in')
  })
})
