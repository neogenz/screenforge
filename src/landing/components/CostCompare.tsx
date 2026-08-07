import { useLang } from '../i18n'

/*
 * Le tableau des trois ans, à l'intérieur de la section tarifs.
 *
 * Il avait sa propre section, son propre `<h2>` (« Possédez l'éditeur, ne le
 * louez pas ») et son propre paragraphe, juste au-dessus d'une section tarifs
 * dont le titre dit « on paie une fois » et dont le chapô réexplique pourquoi.
 * Le même argument était donc énoncé trois fois en six cents pixels, et deux
 * cent trente pixels de noir séparaient les deux titres. Ici il est une
 * démonstration posée entre le chapô et les cartes : le raisonnement est dit
 * une fois, à l'endroit où la décision se prend.
 *
 * La colonne louée grossit, la colonne achetée ne bouge pas — un tableau le
 * démontre mieux qu'une phrase.
 */
export function CostCompare() {
  const { t } = useLang()
  const own = t.ownership
  return (
    <div className="mt-10 max-w-xl">
      <table className="w-full border-collapse text-sm">
        <caption className="pb-3 text-left text-2xs tracking-[0.14em] text-muted-foreground uppercase">
          {own.tableLabel}
        </caption>
        <thead>
          <tr className="border-b border-border/60">
            <th scope="col" className="w-1/3" />
            <th
              scope="col"
              className="w-1/3 pb-2.5 text-right text-xs font-medium text-muted-foreground"
            >
              {own.rentLabel}
            </th>
            <th scope="col" className="w-1/3 pb-2.5 text-right text-xs font-medium text-foreground">
              {own.ownLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {own.rows.map((row) => (
            <tr key={row.year} className="border-b border-border/60 last:border-b-0">
              <th scope="row" className="py-3 text-left font-medium">
                {row.year}
              </th>
              <td className="py-3 text-right tabular-nums text-muted-foreground">{row.rent}</td>
              <td className="py-3 text-right font-semibold tabular-nums text-marker">{row.own}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs leading-4 text-muted-foreground">{own.footnote}</p>
    </div>
  )
}
