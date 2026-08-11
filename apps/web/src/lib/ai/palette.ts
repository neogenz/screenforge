import { resolveAsset } from '@/lib/assets'

/**
 * La direction artistique lue dans les captures, plutôt que devinée.
 *
 * L'utilisateur choisit une direction dans une liste de quatre, et aucune des
 * quatre n'est celle de son application. Or les couleurs de son application sont
 * déjà là, dans les captures qu'il vient de déposer : il suffit de les lire.
 *
 * C'est fait ici et pas par un modèle, pour une raison qui n'est pas seulement
 * de coût : le pont n'envoie aucune image (`providers.ts`), donc aucun modèle
 * branché sur ScreenForge ne voit jamais les captures. Un modèle à qui l'on
 * demanderait la palette de l'application inventerait une palette plausible.
 * Quelques milliers de pixels lus dans l'onglet donnent la vraie, hors ligne et
 * en quelques millisecondes.
 */

export interface Palette {
  /** Le fond des planches. */
  background: string
  /** L'encre des accroches, choisie pour tenir sur ce fond. */
  ink: string
  /** La teinte des formes et des icônes. */
  accent: string
}

/**
 * 24×24 par capture, soit 576 pixels.
 *
 * `drawImage` vers un canevas minuscule fait le sous-échantillonnage pour nous,
 * dans le code natif du navigateur — lire 1320×2868 pixels en JavaScript pour
 * en tirer trois couleurs coûterait cent fois plus pour le même résultat.
 */
const SAMPLE = 24

/** 4 bits par canal : 4096 casiers, assez fins pour séparer deux tons voisins. */
function bucketOf(r: number, g: number, b: number): number {
  return ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/** Luminance relative WCAG : ce qui décide si l'encre est noire ou blanche. */
function luminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const ratio = value / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Saturation HSV : sépare une couleur de marque d'un gris de fond. */
function chroma(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  if (max === 0) return 0
  return (max - Math.min(r, g, b)) / max
}

async function decode(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  return image
}

/**
 * Compte les couleurs de toutes les captures, puis en tire trois.
 *
 * Rend `null` plutôt qu'une palette approximative quand les captures ne portent
 * aucune couleur exploitable : proposer « d'après vos captures » sur une palette
 * inventée serait exactement le mensonge que cette fonction existe pour éviter.
 */
export async function paletteFromScreenshots(assetIds: readonly string[]): Promise<Palette | null> {
  const urls = assetIds.map((id) => resolveAsset(id)).filter((url): url is string => Boolean(url))
  if (urls.length === 0) return null

  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE
  canvas.height = SAMPLE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  const counts = new Map<number, { count: number; r: number; g: number; b: number }>()
  for (const url of urls) {
    let image: HTMLImageElement
    try {
      image = await decode(url)
    } catch {
      // Une capture illisible ne fait pas échouer la lecture des autres.
      continue
    }
    context.clearRect(0, 0, SAMPLE, SAMPLE)
    context.drawImage(image, 0, 0, SAMPLE, SAMPLE)
    const { data } = context.getImageData(0, 0, SAMPLE, SAMPLE)
    for (let at = 0; at < data.length; at += 4) {
      // Un pixel transparent n'est la couleur de personne.
      if (data[at + 3] < 128) continue
      const key = bucketOf(data[at], data[at + 1], data[at + 2])
      const seen = counts.get(key)
      if (seen) {
        seen.count += 1
        seen.r += data[at]
        seen.g += data[at + 1]
        seen.b += data[at + 2]
      } else {
        counts.set(key, { count: 1, r: data[at], g: data[at + 1], b: data[at + 2] })
      }
    }
  }
  if (counts.size === 0) return null

  const buckets = [...counts.values()]
    .map((bucket) => ({
      count: bucket.count,
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
    }))
    .sort((left, right) => right.count - left.count)

  const [dominant] = buckets
  const backgroundLuma = luminance(dominant.r, dominant.g, dominant.b)

  /* L'encre n'est pas tirée des captures : elle est choisie pour être lisible
     sur le fond qui vient d'en être tiré. Une encre échantillonnée pouvait
     tomber à 1,4:1 du fond — une accroche invisible sur la planche exportée. */
  const ink = backgroundLuma > 0.4 ? '#141413' : '#ffffff'

  /* L'accent est la couleur la plus franche qui se détache assez du fond pour
     qu'une forme peinte avec ne s'y fonde pas. Aucune ne convient sur une
     capture en nuances de gris : on rend alors le fond et l'encre seuls, et
     l'appelant garde l'accent de sa direction. */
  const accent = buckets.find(
    (bucket) =>
      chroma(bucket.r, bucket.g, bucket.b) > 0.35 &&
      Math.abs(luminance(bucket.r, bucket.g, bucket.b) - backgroundLuma) > 0.12,
  )

  return {
    background: hex(dominant.r, dominant.g, dominant.b),
    ink,
    accent: accent ? hex(accent.r, accent.g, accent.b) : ink,
  }
}
