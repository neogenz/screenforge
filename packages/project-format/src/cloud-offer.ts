export const MEBIBYTE = 1024 * 1024

/** Public Cloud contract. Rate limits remain backend-only abuse controls. */
export const CLOUD_OFFER = {
  id: 'cloud',
  price: { amount: 39, currency: 'USD', interval: 'year' },
  limits: {
    projects: 100,
    projectBytes: 128 * MEBIBYTE,
    assets: 500,
    assetBytes: 512 * MEBIBYTE,
  },
} as const

export function cloudOfferSummary(locale: 'en' | 'fr'): string {
  const { projects, projectBytes, assets, assetBytes } = CLOUD_OFFER.limits
  const projectMiB = projectBytes / MEBIBYTE
  const assetMiB = assetBytes / MEBIBYTE
  return locale === 'fr'
    ? `${projects} projets et ${projectMiB} Mio de données projet · ${assets} images et ${assetMiB} Mio d’images`
    : `${projects} projects and ${projectMiB} MiB of project data · ${assets} images and ${assetMiB} MiB of images`
}
