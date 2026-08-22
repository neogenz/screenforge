/**
 * Garde-fou d'échelle métrique sur l'interface rendue.
 *
 * Le contraste se vérifie sur le fichier de jetons ; les échelles, non : une
 * taille littérale posée dans une classe utilitaire n'apparaît nulle part dans
 * `index.css`. C'est donc le DOM peuplé qui fait foi, et le script compte les
 * valeurs distinctes réellement rendues plutôt que de comparer à une liste
 * blanche, qui dériverait à chaque changement légitime.
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'

/**
 * Au-delà, l'échelle est ouverte : les écarts ne se lisent plus comme une hiérarchie.
 * @type {['polices' | 'hauteurs' | 'rayons' | 'ecarts', number][]}
 */
const LIMITS = [
  ['polices', 4],
  ['hauteurs', 2],
  ['rayons', 4],
  ['ecarts', 3],
]
/**
 * Le rythme vertical, lui, n'est pas une affaire de nombre de valeurs mais de
 * graduation : une hauteur de ligne fractionnaire décale tout ce qui suit dans
 * la colonne, qu'elle soit seule de son espèce ou non. Les jetons de taille
 * portent désormais des px, et le namespace `--leading-*` nommé est retiré ;
 * `leading-none` reste toutefois un utilitaire statique de Tailwind, donc
 * atteignable. C'est ce que cette mesure attrape.
 */
const BASELINE = 4
/** Éléments affichés à titre d'exemple sous chaque valeur fautive. */
const SAMPLES = 3

/**
 * Le serveur de développement, démarré seulement s'il ne tourne pas déjà :
 * la garde doit s'enchaîner dans `test:release` sans intervention manuelle.
 * @returns {Promise<import('node:child_process').ChildProcess | null>}
 */
async function ensureServer() {
  const reachable = await fetch(baseURL).then(
    () => true,
    () => false,
  )
  if (reachable) return null

  const port = new URL(baseURL).port || '5199'
  /* `detached` pour avoir un groupe de processus à tuer d'un bloc : `pnpm` n'est
     qu'un lanceur, et un SIGTERM sur lui laissait Vite écouter le port. Le
     serveur survivait à l'audit, et la passe e2e suivante le réutilisait
     (`reuseExistingServer`) au lieu de démarrer le sien — un serveur d'une autre
     exécution, qui faisait échouer la mesure de la pellicule à 320px. */
  const child = spawn('pnpm', ['--filter', 'web', 'run', 'dev', '--port', port], {
    stdio: 'ignore',
    detached: true,
  })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (
      await fetch(baseURL).then(
        () => true,
        () => false,
      )
    )
      return child
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  stop(child)
  throw new Error(`serveur injoignable sur ${baseURL} après 30s`)
}

/**
 * Tue le groupe de processus, pas le seul lanceur.
 * @param {import('node:child_process').ChildProcess | null} child
 */
function stop(child) {
  if (!child?.pid) return
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill()
  }
}

const server = await ensureServer()
const stopServer = () => stop(server)
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

await page.goto(baseURL)
// Browser globals inside Playwright's page context.
await page.evaluate(
  () =>
    new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('screenforge')
      request.onsuccess = request.onerror = request.onblocked = () => resolve(undefined)
    }),
)
await page.reload()

await page.waitForFunction(() => Boolean(window.__sfCanvas), { timeout: 20_000 })
await page.waitForTimeout(1200)

// Un écran vide ne rend ni panneau Propriétés ni liste de calques : c'est
// précisément là que vivent les contrôles à mesurer.
await page.click('button[aria-label="Ajouter un cadre iPhone"]')
await page.click('[role="menu"] [role="menuitem"] >> nth=0')
await page.waitForTimeout(500)
await page.click('button[aria-label="Ajouter Texte"]')
await page.waitForTimeout(900)

// La page principale reste rendue derrière la modale : ouvrir l'export ajoute
// donc ses contrôles à la même mesure, sans fabriquer une page de démonstration.
await page.click('button[aria-label="Ouvrir l’export"]')
await page.getByRole('dialog', { name: 'Export officiel' }).waitFor()

// Appel du vrai adaptateur Sonner : le toast mesuré suit exactement le chemin
// des stores et composants, sans dupliquer son DOM dans l'audit.
await page.evaluate(async () => {
  const moduleUrl = new URL('/src/stores/toast.store.ts', window.location.href).href
  const { toast } = await import(moduleUrl)
  toast('Toast de contrôle typographique', 'success', { duration: 30_000 })
})
await page.getByRole('status').filter({ hasText: 'Toast de contrôle typographique' }).waitFor()

const measure = () =>
  page.evaluate(
    ({ SAMPLES }) => {
      // Sont hors grille par nature, et donc hors mesure : le `textarea`, multiligne
      // par définition ; l'interrupteur et le curseur, dont la forme *est*
      // l'affordance ; les cartes checkbox et actions `.field-label`, qui ne sont
      // pas des contrôles denses ; l'input de fichier, invisible et représenté par un bouton.
      const CONTROLS =
        'button:not([role="switch"]):not([role="slider"]):not([role="checkbox"]):not(.field-label), input:not([type="file"]), [role="combobox"], [role="menuitem"], [role="option"]'
      // La pellicule d'écrans dimensionne ses vignettes sur le ratio de l'artboard
      // (`THUMBNAIL_HEIGHT` dans `lib/stage.ts`), pas sur la grille des contrôles.
      const FILMSTRIP = '[role="group"][aria-label="Écrans"]'
      // Le rythme vertical se juge dans les îlots flottants : c'est là qu'on empile.
      const ISLANDS = '.island'

      /** @typedef {Map<string, {count: number, samples: string[]}>} Bucket */
      /** @type {Bucket} */ const polices = new Map()
      /** @type {Bucket} */ const hauteurs = new Map()
      /** @type {Bucket} */ const rayons = new Map()
      /** @type {Bucket} */ const ecarts = new Map()
      /** @type {Bucket} */ const interlignes = new Map()

      /** @param {Element} el */
      const describe = (el) => {
        const text = (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .trim()
          .replace(/\s+/g, ' ')
        return `<${el.tagName.toLowerCase()}> ${text.slice(0, 34) || '(sans libellé)'}`
      }

      /** @param {Bucket} bucket @param {string} value @param {Element} el */
      const tally = (bucket, value, el) => {
        const entry = bucket.get(value) ?? { count: 0, samples: [] }
        entry.count++
        if (entry.samples.length < SAMPLES) entry.samples.push(describe(el))
        bucket.set(value, entry)
      }

      /** @param {Element} el */
      const visible = (el) => {
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }

      for (const el of document.querySelectorAll('body *')) {
        if (!visible(el)) continue

        // Police : seuls les éléments qui portent eux-mêmes du texte comptent, sinon
        // chaque conteneur ferait remonter la taille héritée de ses enfants.
        const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())
        if (ownsText) {
          const { fontSize, lineHeight } = getComputedStyle(el)
          tally(polices, fontSize, el)
          // `normal` est une hauteur que la fonte décide, donc fractionnaire et hors
          // grille : elle compte comme telle plutôt que d'échapper à la mesure.
          tally(
            interlignes,
            lineHeight === 'normal' ? 'normal' : `${Number.parseFloat(lineHeight)}px`,
            el,
          )
        }

        for (const corner of getComputedStyle(el).borderRadius.split(' ')) {
          const px = Number.parseFloat(corner)
          // Un rayon en pourcentage ou démesuré est une pastille, pas une valeur d'échelle.
          if (!corner.endsWith('px') || !(px > 0) || px >= 100) continue
          tally(rayons, `${px}px`, el)
        }
      }

      // Un input sans bordure ni fond remplit la boîte que dessine son parent, comme
      // dans `NumberField` : c'est le parent qui porte la hauteur du contrôle, et
      // l'enfant qui en retranche les bordures. La règle s'arrête à l'input : un
      // bouton fantôme est transparent par variante, pas parce qu'il est imbriqué.
      /** @param {Element} el @returns {Element} */
      const boxOf = (el) => {
        if (el.tagName !== 'INPUT' || !el.parentElement) return el
        const style = getComputedStyle(el)
        const drawsNothing =
          style.borderTopWidth === '0px' && style.backgroundColor === 'rgba(0, 0, 0, 0)'
        return drawsNothing ? el.parentElement : el
      }

      for (const el of document.querySelectorAll(CONTROLS)) {
        if (!visible(el) || el.closest(FILMSTRIP)) continue
        tally(hauteurs, `${Math.round(boxOf(el).getBoundingClientRect().height)}px`, el)
      }

      // Rythme vertical : le `row-gap` déclaré, et non la distance mesurée entre
      // deux frères. C'est l'écart tel qu'il est écrit, donc celui qui dérive ;
      // une distance, elle, mêlerait l'interlignage et les marges de texte.
      for (const el of document.querySelectorAll(`${ISLANDS} *`)) {
        if (!visible(el)) continue
        const { display, flexDirection, flexWrap, rowGap } = getComputedStyle(el)
        // Sur une rangée qui ne passe pas à la ligne, `row-gap` est déclaré mais ne
        // sépare rien verticalement : le compter reviendrait à juger le rythme
        // vertical sur des grappes de boutons alignées horizontalement.
        const stacks =
          display.includes('grid') ||
          (display.includes('flex') && (flexDirection.startsWith('column') || flexWrap === 'wrap'))
        if (!stacks || el.childElementCount < 2) continue
        const px = Number.parseFloat(rowGap)
        if (px > 0) tally(ecarts, `${px}px`, el)
      }

      /** @param {Bucket} bucket */
      const serialise = (bucket) =>
        [...bucket].map(([value, entry]) => ({ value, ...entry })).sort((a, b) => b.count - a.count)

      return {
        polices: serialise(polices),
        hauteurs: serialise(hauteurs),
        rayons: serialise(rayons),
        ecarts: serialise(ecarts),
        interlignes: serialise(interlignes),
      }
    },
    { SAMPLES },
  )

const darkReadings = await measure()
await page.evaluate(async () => {
  const moduleUrl = new URL('/src/stores/ui.store.ts', window.location.href).href
  const { useUIStore } = await import(moduleUrl)
  useUIStore.getState().toggleTheme()
})
await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
const readingsByTheme = { dark: darkReadings, light: await measure() }

await context.close()
await browser.close()
stopServer()

let failures = 0

for (const [theme, readings] of Object.entries(readingsByTheme)) {
  console.log(`\n${theme}`)
  for (const [axis, limit] of LIMITS) {
    const entries = readings[axis]
    const kept = entries.slice(0, limit)
    const strays = entries.slice(limit)

    console.log(`\n${axis} — ${entries.length} valeur(s) distincte(s), ${limit} autorisée(s)`)
    for (const { value, count } of kept) console.log(`  ok   ${value.padStart(6)} ×${count}`)

    for (const { value, count, samples } of strays) {
      failures++
      console.log(`  HORS ${value.padStart(6)} ×${count}`)
      for (const sample of samples) console.log(`         ${sample}`)
    }
  }

  console.log(`\ninterlignes — grille de ${BASELINE}px`)
  for (const { value, count, samples } of readings.interlignes) {
    const px = Number.parseFloat(value)
    if (Number.isFinite(px) && px % BASELINE === 0) {
      console.log(`  ok   ${value.padStart(6)} ×${count}`)
      continue
    }
    failures++
    console.log(`  HORS ${value.padStart(6)} ×${count}`)
    for (const sample of samples) console.log(`         ${sample}`)
  }
}

if (failures > 0) {
  console.log(`\n${failures} valeur(s) hors échelle`)
  process.exit(1)
}

console.log('\nÉchelles fermées.')
