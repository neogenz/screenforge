import { cache } from 'fabric'

const loadedFonts = new Set<string>()
const fontPromises = new Map<string, Promise<FontLoadResult>>()

export interface FontLoadResult {
  family: string
  status: 'loaded' | 'fallback'
  message?: string
}

// `POPULAR_FONTS[0]` sert de police à tout texte neuf : une grotesque au dessin
// affirmé plutôt qu'un neutre de gabarit.
export const POPULAR_FONTS = [
  'Space Grotesk',
  'Archivo',
  'Inter',
  'Roboto',
  'Open Sans',
  'Montserrat',
  'Poppins',
  'Lato',
  'Playfair Display',
  'Oswald',
  'Raleway',
  'Nunito',
  'Merriweather',
  'Source Sans 3',
  'PT Sans',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'Quicksand',
  'Barlow',
  'DM Sans',
  'Noto Sans',
  'Fira Sans',
  'Mulish',
  'Josefin Sans',
  'Inconsolata',
  'Karla',
  'Cabin',
  'Libre Baskerville',
  'EB Garamond',
  'Crimson Text',
  'Cormorant Garamond',
  'Zilla Slab',
  'Rokkitt',
  'Arvo',
  'Bitter',
  'Exo 2',
  'Titillium Web',
  'Anton',
  'Bebas Neue',
  'Righteous',
  'Pacifico',
  'Dancing Script',
  'Lobster',
  'Caveat',
  'Sacramento',
  'Great Vibes',
  'Satisfy',
  'Comfortaa',
  'Fredoka One',
  'Varela Round',
]

export const FONT_WEIGHT_OPTIONS = [
  { value: 300, label: '300 · Léger' },
  { value: 400, label: '400 · Normal' },
  { value: 500, label: '500 · Moyen' },
  { value: 600, label: '600 · Semi-gras' },
  { value: 700, label: '700 · Gras' },
  { value: 800, label: '800 · Extra-gras' },
  { value: 900, label: '900 · Black' },
] as const

function waitForStylesheet(link: HTMLLinkElement): Promise<void> {
  if (link.sheet) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('Google Fonts did not respond in time.'))
    }, 8000)
    function cleanup() {
      window.clearTimeout(timeout)
      link.removeEventListener('load', handleLoad)
      link.removeEventListener('error', handleError)
    }
    function handleLoad() {
      cleanup()
      resolve()
    }
    function handleError() {
      cleanup()
      reject(new Error('Google Fonts stylesheet failed to load.'))
    }
    link.addEventListener('load', handleLoad)
    link.addEventListener('error', handleError)
  })
}

async function loadFont(family: string, weights: string[], key: string): Promise<FontLoadResult> {
  let link: HTMLLinkElement | null = null
  try {
    link = document.querySelector<HTMLLinkElement>(`link[data-font-key="${CSS.escape(key)}"]`)
    if (!link) {
      const familyParam = `${encodeURIComponent(family)}:wght@${weights.join(';')}`
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`
      link.dataset.fontKey = key
      document.head.appendChild(link)
    }

    try {
      await waitForStylesheet(link)
    } catch {
      // Certaines familles n'exposent pas toutes les graisses proposées par
      // l'éditeur (Space Grotesk s'arrête à 700). Google répond alors 400 :
      // charger la face normale laisse le navigateur synthétiser la graisse
      // demandée, sans confondre cette variante absente avec une police absente.
      link.remove()
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`
      link.dataset.fontKey = key
      document.head.appendChild(link)
      await waitForStylesheet(link)
    }
    const faces = await Promise.all(
      weights.map((weight) => document.fonts.load(`${weight} 16px "${family}"`)),
    )
    await document.fonts.ready
    const missingWeights = weights.filter((_, index) => faces[index]?.length === 0)
    if (missingWeights.length > 0) {
      throw new Error(`No font face was returned for ${family} at ${missingWeights.join(', ')}.`)
    }
    loadedFonts.add(key)
    // Fabric mémorise la largeur de chaque glyphe, par famille et par graisse,
    // dans un cache global. Un texte posé avant l'arrivée de la police est
    // mesuré avec la police de secours, et ces largeurs fausses survivent au
    // chargement : les glyphes se dessinent dans la bonne police mais avec les
    // avances de l'autre, d'où les mots collés et les lettres écartées. Purger
    // ici plutôt que chez chaque appelant — canvas, export et aperçus partagent
    // le même cache, et c'est ici, et seulement ici, que la mesure change.
    cache.clearFontCache(family)
    return { family, status: 'loaded' }
  } catch (error) {
    link?.remove()
    const message = error instanceof Error ? error.message : 'Unknown font loading error.'
    return { family, status: 'fallback', message }
  }
}

export function loadGoogleFont(
  family: string,
  weights: string[] = ['400', '700'],
): Promise<FontLoadResult> {
  const normalizedWeights = [...new Set(weights)].sort()
  const key = `${family}:${normalizedWeights.join(',')}`
  if (loadedFonts.has(key)) return Promise.resolve({ family, status: 'loaded' })
  const existing = fontPromises.get(key)
  if (existing) return existing
  const promise = loadFont(family, normalizedWeights, key).then((result) => {
    if (result.status === 'fallback') fontPromises.delete(key)
    return result
  })
  fontPromises.set(key, promise)
  return promise
}

export async function waitForFonts(families: string[]): Promise<FontLoadResult[]> {
  const results = await Promise.all([...new Set(families)].map((family) => loadGoogleFont(family)))
  await document.fonts.ready
  return results
}

export function isFontLoaded(family: string, weights?: string[]): boolean {
  const prefix = `${family}:`
  if (!weights) return [...loadedFonts].some((key) => key.startsWith(prefix))
  return weights.every((weight) =>
    [...loadedFonts].some(
      (key) => key.startsWith(prefix) && key.slice(prefix.length).split(',').includes(weight),
    ),
  )
}
