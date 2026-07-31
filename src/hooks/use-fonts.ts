const loadedFonts = new Set<string>()
const fontPromises = new Map<string, Promise<FontLoadResult>>()

export interface FontLoadResult {
  family: string
  status: 'loaded' | 'fallback'
  message?: string
}

export const POPULAR_FONTS = [
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
  'Space Grotesk',
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

async function loadFont(
  family: string,
  weights: string[],
  key: string,
): Promise<FontLoadResult> {
  try {
    let link = document.querySelector<HTMLLinkElement>(`link[data-font-key="${CSS.escape(key)}"]`)
    if (!link) {
      const familyParam = `${encodeURIComponent(family)}:wght@${weights.join(';')}`
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`
      link.dataset.fontKey = key
      document.head.appendChild(link)
    }

    await waitForStylesheet(link)
    const faces = await Promise.all(
      weights.map((weight) => document.fonts.load(`${weight} 16px "${family}"`)),
    )
    await document.fonts.ready
    if (faces.every((result) => result.length === 0)) {
      throw new Error(`No font face was returned for ${family}.`)
    }
    loadedFonts.add(key)
    return { family, status: 'loaded' }
  } catch (error) {
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
  const promise = loadFont(family, normalizedWeights, key)
  fontPromises.set(key, promise)
  return promise
}

export async function waitForFonts(families: string[]): Promise<FontLoadResult[]> {
  const results = await Promise.all(
    [...new Set(families)].map((family) => loadGoogleFont(family)),
  )
  await document.fonts.ready
  return results
}

export function isFontLoaded(family: string): boolean {
  return [...loadedFonts].some((key) => key.startsWith(`${family}:`))
}
