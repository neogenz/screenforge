/**
 * Garde-fous de la landing : contraste et interdits « impeccable ».
 *
 * Le contraste des encres sur les surfaces est déjà couvert par
 * `contrast-audit.mjs` ; ce script ajoute les couples que seule la landing
 * emploie (CTA plein, badge en relief) et refuse les motifs bannis — texte en
 * dégradé, liseré latéral, glassmorphism décorative, emoji en guise d'icône.
 * Les interdits se lisent dans la source ; le contraste, dans le navigateur.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrast, ensureServer, over, resolveThemeTokens } from './lib/theme-tokens.mjs'

const root = fileURLToPath(new URL('../apps/web/', import.meta.url))
const failures = []

/* ── Contraste : les couples propres à la landing, thème sombre ──
   Les jetons sont lus résolus par le navigateur (`lib/theme-tokens.mjs`) :
   la palette coss s'écrit en `--alpha()` et `color-mix()`, illisibles par
   regex. La vitrine est sombre uniquement. */

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'
const LANDING_PAIRS = [
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['foreground', 'card'],
  ['marker', 'stage'],
  ['marker', 'background'],
]
const stopServer = await ensureServer(baseURL)
let tokens
try {
  tokens = (
    await resolveThemeTokens({
      baseURL,
      path: '/landing.html',
      names: [...new Set([...LANDING_PAIRS.flat(), 'background'])],
      themes: ['dark'],
    })
  ).dark
} finally {
  stopServer()
}
/** @param {string} name */
const token = (name) => {
  const value = tokens.get(name)
  if (!value) throw new Error(`jeton --${name} absent`)
  return value
}
for (const [ink, surface] of LANDING_PAIRS) {
  const ground = over(token(surface), token('background'))
  const ratio = contrast(over(token(ink), ground), ground)
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
for (const claim of ['App Store', 'Google Play', '1320×2868', '1080×1920', '6.9/', 'phone/']) {
  if (!commercialCopy.includes(claim)) failures.push(`profil absent de la vitrine : ${claim}`)
}
const COMMERCIAL_BANS = [
  { pattern: /commercialLaunch/, label: 'ancien interrupteur de lancement commercial' },
  { pattern: /(?:\$49|49\s*\$)/, label: 'ancien prix Local payant' },
  { pattern: /(?:free trial|essai gratuit)/i, label: 'ancien essai Local' },
  {
    pattern: /(?:three watermarked exports|trois exports filigranés)/i,
    label: 'ancien quota Local',
  },
  {
    pattern: /(?:publishes? directly to Google Play|publication Google Play incluse)/i,
    label: 'publication Google Play non livrée',
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
