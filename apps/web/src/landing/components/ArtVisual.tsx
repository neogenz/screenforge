import { cn } from '@/lib/utils'

export function ArtVisual({
  src,
  alt,
  caption,
  priority = false,
  className,
  imageClassName,
}: {
  src: string
  alt: string
  caption?: string
  priority?: boolean
  className?: string
  imageClassName?: string
}) {
  const image = (
    <div className={cn('overflow-hidden border border-border/60 bg-stage', className)}>
      <img
        src={src}
        alt={alt}
        width={1672}
        height={941}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn('h-auto w-full', imageClassName)}
      />
    </div>
  )

  if (!caption) return image

  return (
    <figure>
      {image}
      <figcaption className="mt-3 text-xs text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
