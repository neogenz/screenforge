/**
 * Garde-fou de contraste sur la rampe de jetons.
 *
 * Lit les jetons tels que le navigateur les résout (`lib/theme-tokens.mjs`)
 * et vérifie que chaque encre tient 4.5:1 sur chaque surface, dans les deux
 * thèmes. Un navigateur et non le fichier : coss écrit sa palette en
 * `--alpha()` et `color-mix()`, qu'aucune regex ne lit, et une surface à 4 %
 * d'alpha ne se juge que composée sur ce qui est dessous.
 */
import { contrast, ensureServer, over, resolveThemeTokens } from './lib/theme-tokens.mjs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5199'

/**
 * Encres à contrôler, dans l'ordre du plus foncé au plus discret.
 *
 * `stage-dot` n'y figure pas et n'y figurera pas : le grain de la scène ne porte
 * aucune information, personne ne le lit. À 5% d'alpha il échouerait à 4.5:1 par
 * construction, et le faire passer demanderait de l'assombrir jusqu'à ce qu'il
 * cesse d'être un grain. Un motif décoratif n'est pas une encre.
 */
const INKS = ['foreground', 'muted-foreground']
/** Surfaces sur lesquelles une encre peut se poser. */
const SURFACES = ['stage', 'background', 'card', 'popover', 'muted', 'secondary', 'accent']
/**
 * Couples fermés : une encre qui ne se pose que sur une surface, et pas sur la
 * gamme. Le citron et son encre vivaient sur une valeur annoncée en commentaire
 * et vérifiée par personne. Les signaux coss (`*-foreground` sur `card`) sont
 * les encres de texte des badges et des alertes ; `destructive-foreground` y
 * figure plutôt que dans `INKS` parce qu'il ne se pose pas sur toute la gamme.
 * @type {[string, string][]}
 */
const PAIRS = [
  ['marker-ink', 'marker'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['warning-foreground', 'card'],
  ['success-foreground', 'card'],
  ['info-foreground', 'card'],
  ...['card', 'background', 'stage', 'muted'].map(
    /** @returns {[string, string]} */ (surface) => ['destructive-foreground', surface],
  ),
]

const MIN_RATIO = 4.5

const names = [...new Set([...INKS, ...SURFACES, ...PAIRS.flat(), 'background', 'marker'])]
const stopServer = await ensureServer(baseURL)
let themes
try {
  themes = await resolveThemeTokens({ baseURL, names })
} finally {
  stopServer()
}

/**
 * Une surface translucide se lit sur le fond de la page ; une encre, sur la
 * surface ainsi composée.
 * @param {Map<string, import('./lib/theme-tokens.mjs').Rgba>} tokens
 * @param {string} ink @param {string} surface
 */
function measure(tokens, ink, surface) {
  const page = tokens.get('background')
  const foreground = tokens.get(ink)
  const background = tokens.get(surface)
  if (!page || !foreground || !background) throw new Error(`jeton absent : ${ink} / ${surface}`)
  const ground = over(background, page)
  return contrast(over(foreground, ground), ground)
}

const couples = [...INKS.flatMap((ink) => SURFACES.map((surface) => [ink, surface])), ...PAIRS]
let failures = 0
for (const [theme, tokens] of Object.entries(themes)) {
  for (const [ink, surface] of couples) {
    const ratio = measure(tokens, ink, surface)
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
  const ratios = couples.map(([ink, surface]) => measure(tokens, ink, surface))
  return `${theme} ${Math.min(...ratios).toFixed(2)}:1`
})
console.log(`Contraste OK — pire cas : ${worst.join(', ')}`)
