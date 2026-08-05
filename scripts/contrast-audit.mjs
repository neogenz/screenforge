/**
 * Garde-fou de contraste sur la rampe de jetons.
 *
 * Lit les OKLCH déclarés dans `src/index.css`, les convertit en sRGB et vérifie
 * que chaque encre tient 4.5:1 sur chaque surface, dans les deux thèmes. Aucun
 * navigateur : c'est le fichier de jetons qui fait foi, pas une page rendue, et
 * la vérification doit tourner avant même qu'un serveur existe.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSS = fileURLToPath(new URL('../src/index.css', import.meta.url))

/** Encres à contrôler, dans l'ordre du plus foncé au plus discret. */
const INKS = ['foreground', 'muted-foreground']
/** Surfaces sur lesquelles une encre peut se poser. */
const SURFACES = ['stage', 'background', 'card', 'muted', 'secondary', 'accent']
/**
 * Couples fermés : une encre qui ne se pose que sur une surface, et pas sur la
 * gamme. Les croiser avec `SURFACES` n'aurait aucun sens — `marker-ink` ne se
 * pose jamais sur `card` — mais sans eux ces couples ne sont contrôlés nulle
 * part. Le citron et son encre vivaient ainsi sur une valeur annoncée en
 * commentaire et vérifiée par personne.
 * @type {[string, string][]}
 */
const PAIRS = [['marker-ink', 'marker']]

const MIN_RATIO = 4.5

/**
 * @param {number} lightness
 * @param {number} chroma
 * @param {number} hueDegrees
 * @returns {number[]}
 */
function oklchToRgb(lightness, chroma, hueDegrees) {
  const hue = (hueDegrees * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return linear.map((channel) => Math.min(1, Math.max(0, channel)))
}

/** Luminance relative WCAG : les canaux linéaires sont déjà ce qu'elle demande. */
/** @param {number[]} color */
function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** @param {number[]} first @param {number[]} second */
function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

/**
 * Les jetons d'un thème. Le bloc `@theme` porte le sombre, `.light` le clair ;
 * le clair ne redéclare que ce qui change, d'où la fusion.
 */
function readTokens() {
  const css = readFileSync(CSS, 'utf8')
  const lightStart = css.indexOf('.light {')
  if (lightStart === -1) throw new Error('bloc .light introuvable dans src/index.css')

  /** @param {string} source */
  const parse = (source) => {
    /** @type {Map<string, number[]>} */
    const tokens = new Map()
    const pattern = /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g
    for (const [, name, l, c, h] of source.matchAll(pattern)) {
      tokens.set(name, oklchToRgb(Number(l), Number(c), Number(h)))
    }
    return tokens
  }

  const dark = parse(css.slice(0, lightStart))
  const light = new Map([...dark, ...parse(css.slice(lightStart))])
  return { dark, light }
}

const themes = readTokens()
let failures = 0

for (const [theme, tokens] of Object.entries(themes)) {
  const couples = [
    ...INKS.flatMap((ink) => SURFACES.map((surface) => [ink, surface])),
    ...PAIRS,
  ]
  for (const [ink, surface] of couples) {
    const foreground = tokens.get(ink)
    const background = tokens.get(surface)
    if (!foreground) throw new Error(`jeton --color-${ink} absent du thème ${theme}`)
    if (!background) throw new Error(`jeton --color-${surface} absent du thème ${theme}`)

    const ratio = contrast(foreground, background)
    if (ratio < MIN_RATIO) {
      console.log(`FAIL [${theme}] ${ink} sur ${surface} : ${ratio.toFixed(2)}:1`)
      failures++
    }
  }
}

if (failures > 0) {
  console.log(`\n${failures} couple(s) sous ${MIN_RATIO}:1`)
  process.exit(1)
}

const worst = Object.entries(themes).map(([theme, tokens]) => {
  const ratios = [
    ...INKS.flatMap((ink) => SURFACES.map((surface) => [ink, surface])),
    ...PAIRS,
  ].map(([ink, surface]) => {
    const foreground = tokens.get(ink)
    const background = tokens.get(surface)
    if (!foreground || !background) throw new Error(`jeton absent du thème ${theme}`)
    return contrast(foreground, background)
  })
  return `${theme} ${Math.min(...ratios).toFixed(2)}:1`
})
console.log(`Contraste OK — pire cas : ${worst.join(', ')}`)
