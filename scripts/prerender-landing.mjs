/**
 * Prerender de la landing : un document HTML complet par langue.
 *
 * `vite build` émet une coquille quasi vide (le contenu naît du JS) — normal
 * pour l'éditeur, mauvais pour une vitrine : SEO différé et LCP conditionné
 * par le bundle. Ce script rend l'arbre React en chaîne au build et l'injecte
 * dans la coquille : `dist/landing.html` (EN) et `dist/landing-fr.html` (FR)
 * sortent avec tout leur contenu, puis s'hydratent au runtime.
 *
 * Enchaîné après `vite build` dans le script `build` de package.json.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const ssrOut = join(root, 'dist-ssr')

execFileSync(
  'npx',
  [
    'vite',
    'build',
    '--ssr',
    'src/landing/entry-server.tsx',
    '--outDir',
    'dist-ssr',
    '--logLevel',
    'warn',
  ],
  { cwd: root, stdio: 'inherit' },
)

const ssrFile = readdirSync(ssrOut).find((f) => /entry-server.*\.(js|mjs)$/.test(f))
if (!ssrFile) throw new Error('bundle SSR introuvable dans dist-ssr')
const { render, copy } = await import(pathToFileURL(join(ssrOut, ssrFile)).href)

const template = readFileSync(join(dist, 'landing.html'), 'utf8')

const FILES = { en: 'landing.html', fr: 'landing-fr.html' }

for (const lang of /** @type {const} */ (['en', 'fr'])) {
  const meta = copy[lang].meta
  const file = FILES[lang]
  const content = render(lang)

  let doc = template.replace('<div id="root"></div>', `<div id="root">${content}</div>`)
  doc = doc.replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
  doc = doc.replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
  doc = doc.replace(/(<meta name="description" content=")[^"]*(")/, `$1${meta.description}$2`)
  /* hreflang/canonical relatifs en attendant le domaine — voir landing.html. */
  const alternates = [
    `    <link rel="canonical" href="/${file}" />`,
    `    <link rel="alternate" hreflang="en" href="/landing.html" />`,
    `    <link rel="alternate" hreflang="fr" href="/landing-fr.html" />`,
    `    <link rel="alternate" hreflang="x-default" href="/landing.html" />`,
  ].join('\n')
  doc = doc.replace('</head>', `${alternates}\n  </head>`)

  writeFileSync(join(dist, file), doc)
  console.log(`dist/${file} pré-rendu (${lang})`)
}

rmSync(ssrOut, { recursive: true, force: true })
