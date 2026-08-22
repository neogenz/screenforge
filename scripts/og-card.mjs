/**
 * Régénère public/og-landing.png : la carte sociale, dessinée aux tokens de
 * la landing plutôt que capturée.
 *
 * La carte précédente était une capture de l'éditeur sur un projet vide —
 * la vignette la plus partagée du produit montrait un plan de travail blanc.
 * Ici tout est écrit : le prix vit dans ce fichier, donc `pnpm exec node
 * scripts/og-card.mjs` fait partie d'un changement de prix, au même titre que
 * copy.ts et le JSON-LD de landing.html.
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const out = fileURLToPath(new URL('../apps/web/public/og-landing.png', import.meta.url))
/* Les woff2 sont chargés par URL de fichier : `setContent` sert une page
   `about:blank`, où un chemin relatif ne résout rien. */
const FONTS = new URL('../apps/web/public/fonts', import.meta.url).href
/* Le wordmark est embarqué en data URL : la page est servie en `about:blank`
   par `setContent`, et Chromium n'y résout pas un masque en `file://` — la
   police passe, le masque non, et la marque restait invisible sur la carte.
   Il est masqué (encre de la carte) plutôt qu'affiché, pour rester dans la
   couleur du haut de page quelle qu'elle soit. */
const WORDMARK = `data:image/svg+xml;base64,${readFileSync(
  new URL('../apps/web/public/brand/screenforge-wordmark.svg', import.meta.url),
).toString('base64')}`

/* La rangée montre le maximum Apple. Le nombre reste lu dans `dimensions.ts`
   pour que la carte ne dessine jamais plus de planches que l'éditeur. */
const SCREENS = Number(
  /MAX_PROJECT_SCREENS = (\d+)/.exec(
    readFileSync(new URL('../packages/project-format/src/dimensions.ts', import.meta.url), 'utf8'),
  )?.[1],
)
if (!Number.isInteger(SCREENS)) throw new Error('MAX_PROJECT_SCREENS introuvable')

const SHEET =
  'linear-gradient(160deg, oklch(0.72 0.19 25) 0%, oklch(0.62 0.26 320) 55%, oklch(0.55 0.24 285) 100%)'

const sheets = Array.from(
  { length: SCREENS },
  (_, i) =>
    `<div class="sheet" style="opacity:${i === 0 ? 1 : 0.8};${i === 0 ? 'outline:2px solid oklch(0.87 0.2 124);outline-offset:2px' : ''}"><span class="bar"></span><span class="dev"></span></div>`,
).join('')

const html = `<!doctype html><html><head><meta charset="utf-8" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400..700&display=swap" />
<style>
  /* Les deux voix de la vitrine, lues depuis public/fonts : la carte sociale
     est le premier écran que voit quiconque reçoit le lien, et elle doit
     énoncer dans la même bouche que la page qu'elle annonce. */
  @font-face{font-family:'Gloock';src:url('${FONTS}/gloock-400.woff2') format('woff2');font-weight:400}
  @font-face{font-family:'IBM Plex Mono';src:url('${FONTS}/ibm-plex-mono-400.woff2') format('woff2');font-weight:400}
  @font-face{font-family:'IBM Plex Mono';src:url('${FONTS}/ibm-plex-mono-600.woff2') format('woff2');font-weight:600}
  *{box-sizing:border-box;margin:0}
  body{width:1200px;height:630px;background:oklch(0.145 0 0);color:oklch(0.985 0 0);
       font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;
       justify-content:space-between;padding:64px 72px;overflow:hidden}
  h1{font-family:Gloock,serif;font-size:82px;line-height:1.02;font-weight:400;letter-spacing:-0.022em;max-width:18ch}
  .row{display:flex;align-items:flex-end;justify-content:space-between;gap:56px}
  .lede{font-size:24px;line-height:34px;color:oklch(0.708 0 0);max-width:34ch}
  .price{font-family:'IBM Plex Mono',monospace;font-size:22px;color:oklch(0.985 0 0);font-weight:600}
  .mark{color:oklch(0.87 0.2 124)}
  .brand{width:240px;aspect-ratio:5900/1060;background:oklch(0.985 0 0);
       -webkit-mask:url('${WORDMARK}') center/contain no-repeat;
       mask:url('${WORDMARK}') center/contain no-repeat}
  .strip{display:grid;grid-template-columns:repeat(var(--sheets),1fr);gap:7px;width:340px;flex:0 0 auto}
  .sheet{aspect-ratio:1320/2868;background:${SHEET};border-radius:3px;position:relative;overflow:hidden}
  .bar{position:absolute;top:8%;left:50%;transform:translateX(-50%);width:60%;height:3%;
       border-radius:99px;background:rgba(255,255,255,0.85)}
  .dev{position:absolute;top:24%;left:50%;transform:translateX(-50%);height:58%;aspect-ratio:1170/2532;
       border:1px solid rgba(255,255,255,0.7);background:rgba(0,0,0,0.3);border-radius:18%/8%}
</style></head><body>
  <div class="brand" role="img" aria-label="ScreenForge"></div>
  <h1>Store screenshots,<br />down to the pixel.</h1>
  <div class="row">
    <p class="lede">App Store at native 1320&times;2868. Google Play phone at 1080&times;1920. One local editor, two exact exports.
      <span class="price"><span class="mark">Free on your machine</span> · $39/year Cloud.</span></p>
    <div class="strip" style="--sheets:${SCREENS}">${sheets}</div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.screenshot({ path: out })
await browser.close()
console.log('og-landing.png ok')
