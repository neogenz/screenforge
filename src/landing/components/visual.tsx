/*
 * Emplacement d'un visuel produit. Les captures réelles arrivent en phase 4 ;
 * le cadre porte déjà la graine de scène et la légende définitives, pour que
 * le remplacement soit un changement de `src`, pas de mise en page.
 */
export function VisualPlaceholder({ caption }: { caption: string }) {
  return (
    <figure>
      <div
        aria-hidden
        className="aspect-[16/10] w-full rounded-lg border border-border bg-background [background-image:radial-gradient(var(--color-stage-dot)_1px,transparent_1px)] [background-size:12px_12px]"
      />
      <figcaption className="mt-3 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
