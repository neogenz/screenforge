/*
 * Visuel produit : toujours une capture ou un export réel de l'app, généré
 * par `scripts/landing-visuals.mjs`. Le cadre (hairline, ombre portée, grain
 * de scène en retrait) reste identique quelle que soit l'image.
 */
export function Visual({
  src,
  caption,
  eager = false,
}: {
  src: string
  caption: string
  eager?: boolean
}) {
  return (
    <figure>
      <img
        src={src}
        alt={caption}
        width={2000}
        height={1250}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        className="aspect-[16/10] w-full rounded-lg object-cover shadow-lg outline -outline-offset-1 outline-white/10"
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
