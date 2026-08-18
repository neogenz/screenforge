import { cn } from '@/lib/utils'
import { FileArchive } from 'lucide-react'
import { useLang } from '../i18n'

/*
 * L'archive telle qu'elle arrive, plus la fiche technique du PNG.
 *
 * Remplace une capture censée montrer le dialogue d'export : celle qui était
 * livrée avait été prise pendant le chargement de l'app et ne montrait que
 * l'écran de démarrage. Ici rien n'est photographié — les noms de fichiers
 * suivent `lib/zip.ts` (`{dimension}/{NN}_{nom}.png`) et les dimensions
 * `lib/dimensions.ts`. Pour un produit vendu sur l'exactitude au pixel, la
 * spécification vraie prouve mieux qu'une image d'interface.
 *
 * L'arborescence est tracée au filet plutôt qu'écrite en caractères de
 * dessin. La vitrine charge désormais une mono, donc `└─` s'alignerait — mais
 * un filet reste meilleur : il prend la couleur du thème, se règle au demi
 * pixel et ne dépend pas de la façon dont une fonte dessine ses caractères de
 * boîte, que beaucoup rendent trop courts pour se toucher. Les noms de
 * fichiers et les dimensions, eux, sont bien en mono : c'est un listing.
 */
export function TreeRow({
  label,
  meta,
  last = false,
  muted = false,
}: {
  label: string
  meta?: string
  last?: boolean
  muted?: boolean
}) {
  return (
    <li className="relative flex h-8 items-center gap-3 pl-7">
      <span aria-hidden className="absolute top-0 left-2.5 h-4 w-px bg-border" />
      {!last ? (
        <span aria-hidden className="absolute top-4 bottom-0 left-2.5 w-px bg-border" />
      ) : null}
      <span aria-hidden className="absolute top-4 left-2.5 h-px w-3 bg-border" />
      <span
        className={cn(
          'truncate font-mono text-sm',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {label}
      </span>
      {meta ? (
        <span className="ml-auto shrink-0 font-mono text-2xs text-muted-foreground">{meta}</span>
      ) : null}
    </li>
  )
}

export function ExportSpec() {
  const { t } = useLang()
  const exportCopy = t.features.export
  return (
    <figure>
      <div className="border border-border/60 bg-background p-5 sm:p-6">
        <p className="flex items-center gap-2 font-mono text-sm font-semibold">
          <FileArchive aria-hidden className="size-4 shrink-0 text-marker" />
          {exportCopy.zipName}
        </p>
        <ul className="mt-1">
          <li>
            <p className="relative flex h-8 items-center pl-7 text-sm">
              <span aria-hidden className="absolute top-0 left-2.5 h-4 w-px bg-border" />
              <span aria-hidden className="absolute top-4 left-2.5 h-px w-3 bg-border" />
              <span className="font-mono">6.9/</span>
            </p>
            <ul className="ml-7">
              {exportCopy.zipFiles.map((file) => (
                <TreeRow key={file} label={file} meta="1320 × 2868" />
              ))}
              <TreeRow label={exportCopy.zipMore} last muted />
            </ul>
          </li>
        </ul>

        <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 border-t border-border/60 pt-5 sm:grid-cols-2">
          {exportCopy.specRows.map((row) => (
            <div key={row.key} className="flex items-baseline justify-between gap-4">
              <dt className="text-xs text-muted-foreground">{row.key}</dt>
              <dd className="font-mono text-xs text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">{exportCopy.zipLabel}</figcaption>
    </figure>
  )
}
