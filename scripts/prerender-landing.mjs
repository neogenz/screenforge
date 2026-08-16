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

const root = fileURLToPath(new URL('../apps/web/', import.meta.url))
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
  /* Les balises Open Graph doivent suivre la langue du document : sinon un
     partage de la page FR affiche un titre et un résumé anglais. */
  doc = doc.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${meta.title}$2`)
  /* `\s+` et pas une espace : la balise est écrite sur quatre lignes dans
     landing.html, donc le motif « un espace » ne matchait jamais et le
     `.replace()` était un no-op silencieux. Les deux documents partaient avec
     le même résumé anglais, alors que `og:title`, lui, était bien traduit —
     une balise sur deux, sans que rien ne le signale. */
  doc = doc.replace(
    /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${meta.description}$2`,
  )
  doc = doc.replace(/(<meta property="og:locale" content=")[^"]*(")/, `$1${lang}$2`)
  /* hreflang/canonical relatifs en attendant le domaine — voir landing.html. */
  const alternates = [
    `    <link rel="canonical" href="/${file}" />`,
    `    <link rel="alternate" hreflang="en" href="/landing.html" />`,
    `    <link rel="alternate" hreflang="fr" href="/landing-fr.html" />`,
    `    <link rel="alternate" hreflang="x-default" href="/landing.html" />`,
  ].join('\n')
  /* Le bloc SoftwareApplication de landing.html est statique : la page FR
     servait donc un descriptif et des offres en anglais. Il est réécrit dans
     la langue du document, depuis copy.ts. Les prix restent ici — ce sont des
     données structurées, pas du texte, et ils ne se traduisent pas. */
  const plans = copy[lang].pricing.plans
  const OFFER_PRICES = { local: '0', cloud: '39' }
  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ScreenForge',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    description: meta.description,
    offers: /** @type {const} */ (['local', 'cloud']).map((key) => ({
      '@type': 'Offer',
      name: plans[key].name,
      price: OFFER_PRICES[key],
      priceCurrency: 'USD',
      availability: `https://schema.org/${plans[key].available ? 'InStock' : 'PreOrder'}`,
      description: [plans[key].tagline, ...plans[key].points].join('. '),
    })),
  }
  doc = doc.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${JSON.stringify(software).replace(/</g, '\\u003c')}</script>`,
  )

  /* Le JSON-LD FAQ vient de copy.ts : une seule source pour la question
     affichée et la question indexée, dans la langue du document. */
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: copy[lang].faq.items.map((/** @type {{ q: string; a: string }} */ item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  }
  /* `<` échappé en < : une réponse de FAQ contenant une balise fermante
     couperait le bloc script en deux et casserait le document. */
  const payload = JSON.stringify(faq).replace(/</g, '\\u003c')
  const faqScript = `    <script type="application/ld+json">${payload}</script>`
  doc = doc.replace('</head>', `${alternates}\n${faqScript}\n  </head>`)

  writeFileSync(join(dist, file), doc)
  console.log(`dist/${file} pré-rendu (${lang})`)
}

rmSync(ssrOut, { recursive: true, force: true })
