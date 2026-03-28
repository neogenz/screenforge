const loadedFonts = new Set<string>()

export const POPULAR_FONTS = [
  // Pinned popular
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
  // Extended list
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

export async function loadGoogleFont(
  family: string,
  weights: string[] = ['400', '700'],
): Promise<void> {
  const key = `${family}:${weights.join(',')}`
  if (loadedFonts.has(key)) return

  const familyParam = encodeURIComponent(family) + ':wght@' + weights.join(';')
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`

  // Inject link tag if not already present
  const existing = document.querySelector(`link[data-font="${CSS.escape(family)}"]`)
  if (!existing) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.font = family
    document.head.appendChild(link)
  }

  // Wait for font to be available
  try {
    await document.fonts.load(`400 16px "${family}"`)
  } catch {
    // Font load failed — not critical, just continue
  }

  loadedFonts.add(key)
}

export function isFontLoaded(family: string): boolean {
  return [...loadedFonts].some((k) => k.startsWith(`${family}:`))
}
