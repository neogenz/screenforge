import { useLang } from '../i18n'

/*
 * Marquee cinétique : la fiche technique du produit défile entre le hero et
 * la preuve. Décoratif (aria-hidden), le texte existe déjà dans la page.
 */
export function Marquee() {
  const { t } = useLang()
  const row = t.marquee.join('  ·  ') + '  ·  '
  return (
    <div aria-hidden className="overflow-hidden border-b border-border/60 py-3.5">
      <div className="marquee-track flex w-max">
        {[0, 1].map((copy) => (
          <span
            key={copy}
            className="pr-2 text-sm font-semibold tracking-[0.14em] whitespace-nowrap text-marker uppercase"
          >
            {row.repeat(4)}
          </span>
        ))}
      </div>
    </div>
  )
}
