/**
 * Garde-fou de provenance : une primitive de `ui/` reste coss.
 *
 * Un fichier de `ui/` retouché n'est plus une primitive du registre, c'est
 * une primitive maison qui n'en a que le nom — les correctifs y pourrissent
 * silencieusement puisque personne ne s'attend à devoir les relire. Ce script
 * compare chaque fichier au registre coss (avec cache local), puis balaie le
 * reste de la dette de migration nommée en phase 6 : Radix, `asChild`,
 * l'alias de transition, les contrôles natifs hors liste blanche, les
 * classes v6 mortes.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const offline = process.argv.includes('--offline')
const UI_DIR = 'apps/web/src/components/ui'
const CACHE_DIR = 'node_modules/.cache/coss'
const REGISTRY_BASE = 'https://coss.com/ui/r'

mkdirSync(CACHE_DIR, { recursive: true })

let failures = 0
/** @param {string} message */
function fail(message) {
  failures++
  console.log(`  HORS ${message}`)
}

// --- (a) chaque primitive de ui/ (+ segmented-control.ts) == le registre coss ---

/**
 * `components.json` réécrit les alias `@/registry/default/*` du CLI vers les
 * siens (`ui` -> `components/ui`, `lib` -> `lib`…) : c'est la seule
 * différence mesurée entre le registre et les 38 fichiers actuels du dépôt.
 * @param {string} source
 */
function normalize(source) {
  return source
    .replaceAll('@/registry/default/ui/', '@/components/ui/')
    .replaceAll('@/registry/default/lib/', '@/lib/')
    .replaceAll('@/registry/default/hooks/', '@/hooks/')
    .replaceAll('@/registry/default/components/', '@/components/')
    .replace(/\r\n/g, '\n')
    .trimEnd()
}

/**
 * @param {string} name
 * @returns {Promise<{ files: { path: string; content: string }[] } | null>}
 */
async function registryItem(name) {
  const cachePath = join(CACHE_DIR, `${name}.json`)
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'))
  if (offline) return null
  const res = await fetch(`${REGISTRY_BASE}/${name}.json`)
  if (!res.ok) return null
  const text = await res.text()
  writeFileSync(cachePath, text)
  return JSON.parse(text)
}

const uiNames = readdirSync(UI_DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => f.replace(/\.tsx$/, ''))

/** `segmented-control.ts` : confirmé au registre (`registry/default/lib/segmented-control.ts`), pas une primitive maison. */
const sources = [
  ...uiNames.map((name) => ({ name, localPath: `${UI_DIR}/${name}.tsx` })),
  { name: 'segmented-control', localPath: 'apps/web/src/lib/segmented-control.ts' },
]

console.log('provenance (registre coss)')
for (const { name, localPath } of sources) {
  const item = await registryItem(name)
  if (!item) {
    fail(`${localPath} — registre injoignable (${offline ? 'cache absent, --offline' : 'réseau'})`)
    continue
  }
  const base = localPath.split('/').pop() ?? localPath
  const entry = item.files.find((f) => f.path.endsWith(base)) ?? item.files[0]
  const registry = normalize(entry.content)
  const local = normalize(readFileSync(localPath, 'utf8'))
  if (registry !== local) fail(`${localPath} — diverge du registre`)
  else console.log(`  ok   ${localPath}`)
}

// --- (b) dette v6 : Radix, tw-animate-css, asChild ---

/** @type {string[]} */
const srcFiles = []
/** @param {string} dir */
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else if (/\.(tsx?|css)$/.test(entry.name)) srcFiles.push(p)
  }
}
walk('apps/web/src')

/** @type {Array<[string, RegExp]>} */
const STATIC_PATTERNS = [
  ['@radix-ui', /@radix-ui/],
  ['tw-animate-css', /tw-animate-css/],
  ['asChild', /\basChild\b/],
]

console.log('\ndette v6 (statique)')
let staticHit = false
for (const file of srcFiles) {
  const content = readFileSync(file, 'utf8')
  for (const [label, re] of STATIC_PATTERNS) {
    if (re.test(content)) {
      staticHit = true
      fail(`${file} — contient ${label}`)
    }
  }
}
if (!staticHit) console.log('  ok   aucun @radix-ui, tw-animate-css, asChild')

// --- (c) le bloc d'alias de transition de index.css est vide/absent ---

const indexCss = readFileSync('apps/web/src/index.css', 'utf8')
console.log('\nalias de transition (index.css)')
if (indexCss.includes('alias de transition')) {
  fail('apps/web/src/index.css — bloc « alias de transition » encore présent')
} else {
  console.log('  ok   bloc absent')
}

// --- (d) aucun <button>/<input> natif hors liste blanche ---

/**
 * Portée : `src/components` (+ `App.tsx`, cité par le plan) — `src/landing`
 * a son propre `.demo-island` et ses propres audits (`landing-audit.mjs`),
 * c'est un site vitrine, pas l'app coss.
 */
const buttonInputScope = [...srcFiles.filter((f) => f.includes('/src/components/'))].filter(
  (f) => !f.includes('/components/ui/') && !f.endsWith('screens-bar/ScreenThumbnail.tsx'),
)
buttonInputScope.push('apps/web/src/App.tsx')

console.log('\ncontrôles natifs (button/input)')
let nativeHit = false
for (const file of buttonInputScope) {
  const content = readFileSync(file, 'utf8')
  // Une balise JSX étale ses attributs sur plusieurs lignes ; on capture
  // jusqu'au `>` fermant pour lire `type="file"` où qu'il tombe dedans.
  for (const match of content.matchAll(/<(button|input)\b[^>]*>/gs)) {
    const tag = match[0]
    if (/type=["']file["']/.test(tag)) continue // fichier caché, déclenché par un bouton
    // Composition Base UI : `render={<button .../>}` change le tag rendu par
    // une primitive `useRender` (Card, Menu…) — ce n'est pas un bouton fait
    // maison, c'est la grammaire coss elle-même.
    const before = content.slice(Math.max(0, match.index - 40), match.index)
    if (/render=\{\s*$/.test(before)) continue
    const line = content.slice(0, match.index).split('\n').length
    nativeHit = true
    fail(`${file}:${line} — ${tag.split('\n')[0].trim()}`)
  }
}
if (!nativeHit) console.log('  ok   aucun <button>/<input> natif hors liste blanche')

// --- (e) jetons de la vitrine employés dans l'éditeur ---

/**
 * L'éditeur et la vitrine ne partagent pas leur thème : `landing.css` déclare
 * son propre `@theme static`, l'éditeur tient le sien dans `index.css` et
 * `design-system/tokens.css`. Un jeton qui ne vit que dans la vitrine s'écrit
 * donc sans erreur dans l'éditeur, où Tailwind n'émet rien pour lui — la
 * compilation passe, l'élément se peint à sa taille héritée, et `audit:scale`
 * y lit une valeur parfaitement légitime de l'échelle.
 *
 * C'est arrivé à `text-2xs` : la vitrine a gardé son échelon à 11px quand
 * l'éditeur est passé aux tailles coss (12/14/16), et quatre libellés annoncés
 * à 11px se sont rendus à 14 dans quatre dialogues. La liste en dur qui
 * occupait cette place (`.island`, `.surface-inner`) ne pouvait attraper que
 * les deux noms qu'elle connaissait ; celle-ci se relit dans `landing.css` à
 * chaque exécution, donc elle suit la divergence des deux thèmes sans être
 * tenue à jour.
 *
 * Ce garde ne prétend pas trouver toute classe morte : une garde générale
 * demanderait la CSS de production, puisqu'en développement Tailwind n'a pas
 * encore vu les primitives des dialogues chargés paresseusement — mesuré, 165
 * classes coss vivantes déclarées mortes sur un serveur froid. Il couvre la
 * divergence des deux thèmes, qui est la seule à s'être produite.
 */
const LANDING_CSS = 'apps/web/src/landing/landing.css'
/** Les espaces de noms Tailwind, et l'utilitaire qu'un jeton y engendre. */
const TOKEN_NAMESPACES = [
  ['--text-', 'text'],
  ['--color-', ['text', 'bg', 'border', 'ring', 'fill', 'stroke', 'from', 'to', 'via', 'outline']],
  ['--radius-', 'rounded'],
  ['--shadow-', 'shadow'],
  ['--font-', 'font'],
  ['--animate-', 'animate'],
  ['--ease-', 'ease'],
  ['--tracking-', 'tracking'],
  ['--leading-', 'leading'],
]

/**
 * Les blocs `@theme` d'une feuille, et eux seuls : un `--shadow-md` réécrit
 * dans un `:root` ordinaire ne crée aucune classe, il retouche une valeur que
 * Tailwind fournit déjà. Les confondre faisait passer `shadow-md` pour un
 * jeton réservé à la vitrine, dans quatre fichiers qui l'emploient à bon droit.
 * @param {string} css
 */
function themeBlocks(css) {
  const blocks = []
  const opener = /@theme[^{]*\{/g
  while (opener.exec(css) !== null) {
    let i = opener.lastIndex
    let depth = 1
    const start = i
    for (; i < css.length && depth > 0; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
    }
    blocks.push(css.slice(start, i - 1))
  }
  return blocks.join('\n')
}

const landingTheme = themeBlocks(readFileSync(LANDING_CSS, 'utf8'))
/* Le thème de l'éditeur, plus celui que Tailwind fournit d'origine : un jeton
   que la vitrine se contente de réécrire reste disponible des deux côtés. */
const editorTheme = [
  'apps/web/src/index.css',
  'apps/web/src/design-system/tokens.css',
  'node_modules/tailwindcss/theme.css',
]
  .filter((file) => existsSync(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

/** @type {Map<string, string>} classe interdite -> jeton dont elle vient */
const landingOnly = new Map()
for (const [namespace, prefixes] of TOKEN_NAMESPACES) {
  const declared = new RegExp(`^\\s*\\${namespace}([a-z0-9-]+)\\s*:`, 'gm')
  for (const match of landingTheme.matchAll(declared)) {
    const name = match[1]
    // Un suffixe de configuration (`--text-2xs--line-height`) n'est pas un jeton.
    if (name.includes('--')) continue
    if (new RegExp(`^\\s*\\${namespace}${name}\\s*:`, 'm').test(editorTheme)) continue
    for (const prefix of [prefixes].flat()) landingOnly.set(`${prefix}-${name}`, namespace + name)
  }
}

console.log('\njetons de la vitrine dans l’éditeur')
let landingLeak = false
for (const file of srcFiles.filter((f) => /\.tsx?$/.test(f) && !f.includes('/src/landing/'))) {
  const content = readFileSync(file, 'utf8')
  for (const [cls, token] of landingOnly) {
    if (!new RegExp(`(?<![-\\w/])${cls}(?![-\\w])`).test(content)) continue
    landingLeak = true
    fail(`${file} — .${cls} vient de \`${token}\`, déclaré par la seule vitrine`)
  }
}
if (!landingLeak) {
  console.log(`  ok   aucune des ${landingOnly.size} classes réservées à la vitrine`)
}

if (failures > 0) {
  console.log(`\n${failures} défaut(s)`)
  process.exit(1)
}
console.log('\nProvenance coss intacte.')
