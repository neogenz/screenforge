import { useLang } from '../i18n'

/*
 * Marquee cinétique : la fiche technique du produit défile entre le hero et
 * la preuve. Décoratif (aria-hidden), le texte existe déjà dans la page.
 */
export function Marquee() {
  const { t } = useLang()
  const row = t.marquee.join('  ·  ') + '  ·  '
  return (
    <div
      aria-hidden
      className="overflow-hidden border-b border-border/60 bg-stage py-5 [mask-image:linear-gradient(90deg,transparent,black_4rem,black_calc(100%-4rem),transparent)]"
    >
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <span
            key={copy}
            className="pr-2 font-mono text-[13px] tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase"
          >
            {row.repeat(4)}
          </span>
        ))}
      </div>
    </div>
  )
}
