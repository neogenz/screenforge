/**
 * Les jetons de couleur tels que le navigateur les résout.
 *
 * coss écrit sa palette en `--alpha()` et `color-mix()` : une regex sur le
 * fichier n'en lit plus rien, et les jetons d'extension (`tokens.css`) sont
 * déclarés dans `:root` / `.dark`. On pose donc chaque jeton sur un élément
 * sonde, on relit la couleur calculée, et on la passe par un canvas pour
 * obtenir du sRGB 8 bits à alpha droit — la seule forme sur laquelle un
 * contraste WCAG se calcule. Les surfaces translucides sont composées sur
 * leur fond avant mesure, sinon un lavis à 4 % est mesuré comme du noir.
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'

/**
 * Le serveur de développement, démarré seulement s'il ne tourne pas déjà.
 * @param {string} baseURL
 * @returns {Promise<() => void>} arrêt du serveur démarré ici (no-op sinon)
 */
export async function ensureServer(baseURL) {
  const up = () =>
    fetch(baseURL).then(
      () => true,
      () => false,
    )
  if (await up()) return () => {}

  const port = new URL(baseURL).port || '5199'
  const child = spawn('pnpm', ['--filter', 'web', 'run', 'dev', '--port', port], {
    stdio: 'ignore',
    detached: true,
  })
  const stop = () => {
    if (!child.pid) return
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill()
    }
  }
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (await up()) return stop
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  stop()
  throw new Error(`serveur injoignable sur ${baseURL} après 30s`)
}

/**
 * @typedef {[number, number, number, number]} Rgba canaux 0–1, alpha droit
 */

/**
 * Résout des jetons dans les deux thèmes.
 *
 * @param {object} options
 * @param {string} options.baseURL
 * @param {string} [options.path] chemin de la page à charger (`/` par défaut)
 * @param {string[]} options.names noms de jetons sans `--` (`foreground`, `stage`…)
 * @param {('dark' | 'light')[]} [options.themes]
 * @returns {Promise<Record<'dark' | 'light', Map<string, Rgba>>>}
 */
export async function resolveThemeTokens({
  baseURL,
  path = '/',
  names,
  themes = ['dark', 'light'],
}) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(new URL(path, baseURL).href, { waitUntil: 'load' })
  await page.waitForFunction(
    () => getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim() !== '',
    { timeout: 20_000 },
  )

  /** @type {Record<string, Map<string, Rgba>>} */
  const result = {}
  for (const theme of themes) {
    const raw = await page.evaluate(
      ({ names, theme }) => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        const probe = document.createElement('span')
        document.body.append(probe)
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
        if (!context) throw new Error('canvas 2d indisponible')
        const root = getComputedStyle(document.documentElement)
        /** @type {Record<string, number[] | null>} */
        const out = {}
        for (const name of names) {
          if (!root.getPropertyValue(`--${name}`).trim()) {
            out[name] = null
            continue
          }
          probe.style.color = `var(--${name})`
          const computed = getComputedStyle(probe).color
          context.clearRect(0, 0, 1, 1)
          context.fillStyle = computed
          context.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
          out[name] = [r / 255, g / 255, b / 255, a / 255]
        }
        probe.remove()
        return out
      },
      { names, theme },
    )
    const tokens = new Map()
    for (const [name, value] of Object.entries(raw)) {
      if (!value) throw new Error(`jeton --${name} absent du thème ${theme}`)
      tokens.set(name, /** @type {Rgba} */ (value))
    }
    result[theme] = tokens
  }

  await browser.close()
  return /** @type {Record<'dark' | 'light', Map<string, Rgba>>} */ (result)
}

/**
 * Compose `top` sur `bottom` (alpha droit, sRGB encodé — une approximation
 * suffisante pour un lavis à quelques pour cent).
 * @param {Rgba} top
 * @param {Rgba} bottom
 * @returns {Rgba}
 */
export function over(top, bottom) {
  const alpha = top[3] + bottom[3] * (1 - top[3])
  if (alpha === 0) return [0, 0, 0, 0]
  const channel = (/** @type {number} */ index) =>
    (top[index] * top[3] + bottom[index] * bottom[3] * (1 - top[3])) / alpha
  return [channel(0), channel(1), channel(2), alpha]
}

/** @param {number} channel sRGB encodé 0–1 */
function linear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** @param {Rgba} color */
export function luminance([r, g, b]) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** Contraste WCAG entre deux couleurs opaques. @param {Rgba} first @param {Rgba} second */
export function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}
