/**
 * Garde-fous de la landing : contraste et interdits « impeccable ».
 *
 * Le contraste des encres sur les surfaces est déjà couvert par
 * `contrast-audit.mjs` ; ce script ajoute les couples que seule la landing
 * emploie (CTA plein, badge en relief) et refuse les motifs bannis — texte en
 * dégradé, liseré latéral, glassmorphism décorative, emoji en guise d'icône.
 * Aucun navigateur : la source fait foi.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../apps/web/', import.meta.url))
const failures = []

/* ── Contraste : les couples propres à la landing, thème sombre ── */

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
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => Math.min(1, Math.max(0, channel)))
}

/** @param {number[]} color */
function luminance([r, g, b]) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** @param {number[]} first @param {number[]} second */
function contrast(first, second) {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (high + 0.05) / (low + 0.05)
}

const theme = readFileSync(join(root, 'src/index.css'), 'utf8')
const darkBlock = theme.slice(theme.indexOf('@theme static {'), theme.indexOf('@custom-variant'))
const tokens = new Map()
for (const match of darkBlock.matchAll(
  /--color-([a-z0-9-]+):\s*oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)\s*;/g,
)) {
  tokens.set(match[1], oklchToRgb(Number(match[2]), Number(match[3]), Number(match[4])))
}

const LANDING_PAIRS = [
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['foreground', 'card'],
  ['marker', 'stage'],
  ['marker', 'background'],
]
for (const [ink, surface] of LANDING_PAIRS) {
  const ratio = contrast(tokens.get(ink), tokens.get(surface))
  if (ratio < 4.5) {
    failures.push(`contraste ${ink} sur ${surface} : ${ratio.toFixed(2)}:1 (< 4.5:1)`)
  }
}

/* ── Interdits impeccable : scan de la source de la landing ── */

const BANS = [
  { pattern: /-?background-clip:\s*text/, label: 'texte en dégradé (background-clip: text)' },
  { pattern: /border-(left|right):\s*(?:[2-9]|\d{2,})px/, label: 'liseré latéral > 1px' },
  { pattern: /backdrop-filter/, label: 'glassmorphism (backdrop-filter)' },
  {
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    label: 'emoji en guise d\u2019icône',
  },
]

/** @param {string} dir @returns {Generator<string>} */
function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path
  }
}

const sources = [...walk(join(root, 'src/landing')), join(root, 'landing.html')]
for (const file of sources) {
  const content = readFileSync(file, 'utf8')
  for (const ban of BANS) {
    if (ban.pattern.test(content)) {
      failures.push(`${file.replace(root, '')}: ${ban.label}`)
    }
  }
}

const commercialSources = [...sources, fileURLToPath(new URL('./og-card.mjs', import.meta.url))]
const commercialCopy = commercialSources.map((file) => readFileSync(file, 'utf8')).join('\n')
const COMMERCIAL_BANS = [
  { pattern: /commercialLaunch/, label: 'ancien interrupteur de lancement commercial' },
  { pattern: /(?:\$49|49\s*\$)/, label: 'ancien prix Local payant' },
  { pattern: /(?:free trial|essai gratuit)/i, label: 'ancien essai Local' },
  {
    pattern: /(?:three watermarked exports|trois exports filigranés)/i,
    label: 'ancien quota Local',
  },
]
for (const ban of COMMERCIAL_BANS) {
  if (ban.pattern.test(commercialCopy)) failures.push(`offre : ${ban.label}`)
}

/* ── Prérendu : la page livrée doit être lisible sans JavaScript ──
   Une régression coûteuse et silencieuse : dix conteneurs d'apparition
   sortaient du prerender en `opacity: 0`, titre principal compris. Le HTML
   pesait ses 56 ko, le crawler et le lecteur sans JS voyaient une page noire.
   Ne tourne qu'après un build ; si un `opacity-0` légitime apparaît un jour,
   c'est ici qu'on le nomme, pas ici qu'on supprime le garde-fou. */
for (const file of ['dist/landing.html', 'dist/landing-fr.html']) {
  const path = join(root, file)
  if (!existsSync(path)) continue
  const doc = readFileSync(path, 'utf8')
  if (!/<h1[^>]*>[^<]/.test(doc)) failures.push(`${file} : pas de <h1> pré-rendu`)
  if (/class="[^"]*\bopacity-0\b/.test(doc)) {
    failures.push(`${file} : contenu pré-rendu masqué (opacity-0), invisible sans JS`)
  }
  /* La démo est servie composée, jamais vide. Le premier écran sous le pli
     montrait un éditeur sans rien dessus — l'image qui ne vend rien — et un
     lecteur sans JS n'en voyait jamais d'autre, puisque la construction est
     précisément ce que le script fait. Dix vignettes pleines et l'appareil
     dans la liste des calques : c'est l'état final de la séquence. */
  const filledTiles = doc.match(/data-demo-tile="filled"/g)?.length ?? 0
  if (filledTiles !== 10) {
    failures.push(
      `${file} : démo pré-rendue à ${String(filledTiles)} vignettes pleines, attendu 10`,
    )
  }
  if (!doc.includes('data-cursor-target="layer-row-device"')) {
    failures.push(`${file} : démo pré-rendue sans calque d'appareil`)
  }
}

if (failures.length > 0) {
  console.error('audit landing : échec')
  failures.forEach((failure) => console.error(`  - ${failure}`))
  process.exit(1)
}
console.log('audit landing : contraste et interdits impeccable OK')
