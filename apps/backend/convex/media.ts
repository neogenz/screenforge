/**
 * Ce qu'un compte a le droit de téléverser, écrit une fois.
 *
 * Ces valeurs bornaient un import local dans `apps/web/src/lib/image.ts`.
 * Convex ne filtre rien : une URL de téléversement accepte n'importe quel
 * octet, donc le plafond est du code serveur, et ce code a besoin des mêmes
 * nombres que l'éditeur. Deux copies dériveraient sans que rien ne le signale ;
 * ils sont donc ici, et l'éditeur les réexporte.
 */

export const MAX_IMAGE_FILE_BYTES = 16 * 1024 * 1024

export const CONTENT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'] as const

/**
 * Le plafond du document de projet envoyé au nuage.
 *
 * Il n'avait pas d'équivalent avant : `data jsonb` acceptait ce qu'on lui
 * donnait. Un document Convex plafonne à 1 MiB, ce qui a fait sortir le JSON du
 * document vers un fichier — et un fichier sans plafond est un trou de coût.
 *
 * 4 MiB laisse plus de trois fois la taille mesurée du pire cas prévu : un projet portant
 * `MAX_PROJECT_RELEASES` (20) instantanés complets et `MAX_PROJECT_LOCALES`
 * (12) variantes. Les vignettes en sont retirées avant l'envoi
 * (`projectWithoutThumbnails`), et les images ne sont pas dedans — elles ont
 * leur propre chemin, borné par `MAX_IMAGE_FILE_BYTES`.
 */
export const MAX_PROJECT_BLOB_BYTES = 4 * 1024 * 1024

export function isContentImageType(contentType: string): boolean {
  return (CONTENT_IMAGE_TYPES as readonly string[]).includes(contentType)
}
