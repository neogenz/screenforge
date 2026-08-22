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

// --- (e) classes v6 mortes : .island, .surface-inner ---

/**
 * `.panel-title`/`.section-title`/`.field-label` restent des classes
 * légitimes (hiérarchie de titres, grammaire de champ documentées dans
 * CLAUDE.md) tant qu'elles ont une définition permanente — hors du périmètre
 * de ce garde. Voir le rapport de tâche pour `.field-label`, dans le même cas
 * que `.surface-inner` mais non retenu par la portée demandée.
 */
const DEAD_CLASSES = ['island', 'surface-inner']

console.log('\nclasses v6 mortes')
let deadHit = false
for (const file of srcFiles.filter((f) => !f.includes('/src/landing/'))) {
  const content = readFileSync(file, 'utf8')
  const classNameCtx = content.match(/className\s*=\s*(["'`])(?:(?!\1).)*\1/gs) ?? []
  for (const cls of DEAD_CLASSES) {
    const re = new RegExp(`(?<![-\\w])${cls}(?![-\\w])`)
    if (classNameCtx.some((attr) => re.test(attr))) {
      deadHit = true
      fail(`${file} — classe .${cls} encore utilisée`)
    }
  }
}
if (!deadHit) console.log('  ok   aucune classe .island / .surface-inner')

if (failures > 0) {
  console.log(`\n${failures} défaut(s)`)
  process.exit(1)
}
console.log('\nProvenance coss intacte.')
