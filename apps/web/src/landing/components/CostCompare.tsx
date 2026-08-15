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
 *
 * Chaque cellule est une phrase entière. L'intitulé disait « Total payé au
 * bout de » et l'en-tête de ligne « 1 an » : le lecteur devait assembler la
 * phrase en croisant deux axes, et en français elle sortait fausse — « au bout
 * de 1 an » au lieu de « au bout d'un an ». Un texte d'interface qui se
 * complète d'une cellule à l'autre n'est pas traduisible non plus : le
 * traducteur ne peut pas réordonner ce qu'il reçoit en morceaux. L'intitulé
 * nomme donc ce que sont les nombres — des cumuls, sans quoi 198 $ se lirait
 * comme un tarif annuel — et chaque ligne porte son propre repère de temps.
 *
 * La colonne louée nomme AppScreens Pro. « Un abonnement annuel » décrivait une
 * catégorie, donc une somme que le lecteur ne pouvait ni situer ni vérifier ;
 * le nom la rend contrôlable, et il ne coûte rien de plus puisque la note le
 * citait déjà juste dessous. Elle a perdu son « 99 $/an » en même temps : la
 * première ligne l'affiche, l'en-tête n'a pas à le redire. La note ne garde
 * donc que ce qu'elle seule porte — que ce prix est le tarif public, et à
 * quelle date il a été relevé — mais elle renomme AppScreens Pro plutôt que
 * d'écrire « son » : un renvoi vers une cellule du tableau est exactement le
 * défaut qu'on vient d'enlever, et la note est aussi ce qu'on cite seul.
 *
 * Il est centré, et sur la mesure du chapô, parce qu'il appartient à
 * l'argument et pas à l'offre. La section a deux axes : le titre, le chapô et
 * la démonstration tiennent une colonne étroite au centre, les deux cartes et
 * le comparatif prennent la largeur. Aligné à gauche sur 45 % de la page, le
 * tableau n'était sur ni l'un ni l'autre — seul élément hors axe de la
 * section, avec sept cents pixels de noir à sa droite que rien ne venait
 * occuper. Sa largeur suit celle du chapô plutôt qu'un palier choisi : deux
 * blocs centrés dont les bords se ratent de huit pixels se lisent moins bien
 * qu'un seul mal placé.
 */
export function CostCompare() {
  const { t } = useLang()
  const own = t.ownership
  return (
    <div className="mx-auto mt-10 w-full max-w-[65ch] text-[15px]">
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
