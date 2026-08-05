import { SpecLabel } from './SpecLabel'

/*
 * En-tête de section numéroté : la cote « 01 » en tabulaire, le nom de
 * section en label technique, posés sur un filet plein container.
 */
export function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-border/60 pb-4">
      <span className="text-sm font-semibold tabular-nums text-marker">{index}</span>
      <SpecLabel>{title}</SpecLabel>
    </div>
  )
}
