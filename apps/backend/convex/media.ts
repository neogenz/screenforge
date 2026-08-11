/**
 * Ce qu'un compte a le droit de téléverser, écrit une fois.
 *
 * Ces valeurs vivaient dans `apps/web/src/lib/image.ts`, où elles bornaient un
 * import local. Le bucket Supabase les redisait de son côté — `file_size_limit`
 * et `allowed_mime_types` — et les deux pouvaient diverger sans que rien ne le
 * signale. Convex ne filtre rien du tout : une URL de téléversement accepte
 * n'importe quel octet, donc le contrôle est du code, et ce code a besoin des
 * mêmes nombres que l'éditeur. Ils sont ici, l'éditeur les réexporte.
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
 * 32 MiB est mesuré sur le pire cas prévu par le modèle : un projet portant
 * `MAX_PROJECT_RELEASES` (20) instantanés complets et `MAX_PROJECT_LOCALES`
 * (12) variantes. Les vignettes en sont retirées avant l'envoi
 * (`projectWithoutThumbnails`), et les images ne sont pas dedans — elles ont
 * leur propre chemin, borné par `MAX_IMAGE_FILE_BYTES`.
 */
export const MAX_PROJECT_BLOB_BYTES = 32 * 1024 * 1024

export function isContentImageType(contentType: string): boolean {
  return (CONTENT_IMAGE_TYPES as readonly string[]).includes(contentType)
}
