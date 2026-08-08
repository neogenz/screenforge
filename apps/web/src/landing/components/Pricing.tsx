import { cn } from '@/lib/utils'
import { Check, Cloud, HardDrive } from 'lucide-react'
import { useLang } from '../i18n'
import { LINKS, notify } from '../links'
import { CostCompare } from './CostCompare'
import { SectionHeading } from './SectionHeading'
import { SpecLabel } from './SpecLabel'

type Plan = {
  name: string
  price: string
  period: string
  tagline: string
  points: string[]
  badge?: string
  note?: string
  cta: string
  available: boolean
  availabilityNote: string
  href: string
  storage: string
  cloud: boolean
  highlighted: boolean
}

/*
 * Trois cartes, une seule décision : la Licence. Le Gratuit sert à juger,
 * le Cloud est un complément, pas un concurrent — sans la règle « le Cloud
 * exige la Licence », un mois d'abonnement achèterait ce que la Licence
 * achète, et personne ne paierait 49 $.
 *
 * Chaque carte dit où vivent les projets : c'est la ligne de partage réelle
 * entre les offres, et la seule fonction du produit qui coûte un serveur tous
 * les mois — donc la seule qui se facture tous les ans.
 *
 * Les boutons payants ne prétendent pas encaisser : le checkout n'existe pas
 * encore, et la mention vit sous le bouton concerné, pas en note de bas de
 * section où personne ne la lit avant d'avoir cliqué.
 *
 * Le citron va au bouton qui marche, pas à la carte recommandée. La page
 * apprend à l'œil pendant trois mille pixels que citron = « c'est ici qu'on
 * clique » ; poser ce citron sur « Être prévenu à l'ouverture » braquait cet
 * apprentissage sur une impasse et laissait la seule action réalisable en
 * contour. La recommandation reste dite par la carte — fond, anneau, badge —
 * qui sont des états, pas des actions.
 */
function PlanCard({ plan }: { plan: Plan }) {
  const StorageIcon = plan.cloud ? Cloud : HardDrive
  return (
    <div
      className={cn(
        'flex h-full flex-col p-6 ring-1 transition-colors duration-200 ease-out',
        plan.highlighted
          ? 'bg-marker-soft ring-marker-line hover:ring-marker'
          : 'bg-card ring-border hover:ring-foreground/35',
      )}
    >
      {/* Hauteur réservée pour le badge : sans elle, la carte qui le porte
          descend son prix de quatre pixels et les trois chiffres les plus
          comparés de la page ne partagent plus de ligne de base. */}
      <div className="flex min-h-5 items-center justify-between gap-3">
        <SpecLabel>{plan.name}</SpecLabel>
        {plan.badge ? (
          <span className="bg-marker px-2 py-0.5 font-mono text-2xs font-semibold text-marker-ink uppercase">
            {plan.badge}
          </span>
        ) : null}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="font-mono text-[2.1rem] leading-none font-normal tracking-[-0.02em]">
          {plan.price}
        </span>
        {plan.period ? <span className="text-sm text-muted-foreground">{plan.period}</span> : null}
      </p>
      <p className="mt-2 min-h-8 text-xs leading-4 text-muted-foreground">{plan.tagline}</p>
      {/* Ligne réservée sur les trois cartes : seul le Cloud porte une note,
          et sans réserve son séparateur et sa ligne « où vivent vos projets »
          descendaient de 40 px — la seule ligne comparable des trois cartes ne
          partageait plus de ligne de base. */}
      <p className="mt-2 min-h-4 text-xs leading-4 font-medium">{plan.note ?? ' '}</p>

      <p className="mt-5 flex min-h-12 items-start gap-2 border-t border-border/60 pt-4 text-xs leading-4">
        <StorageIcon
          aria-hidden
          className={cn(
            'mt-px size-3.5 shrink-0',
            plan.cloud ? 'text-marker' : 'text-muted-foreground',
          )}
        />
        {plan.storage}
      </p>

      {/* Ce que la carte achète. La Licence — la seule décision de la page —
          n'énonçait aucun bénéfice : pour savoir ce que 49 $ donnent il fallait
          descendre sous un tableau sur trois ans et un bloc de notes jusqu'à un
          comparatif six cents pixels plus bas. Le vide que ça creusait au-dessus
          du bouton se mesurait à 88 px sur la carte Gratuit. */}
      <ul className="mt-4 flex flex-col gap-2">
        {plan.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-xs leading-4">
            <Check
              aria-hidden
              className={cn(
                'mt-px size-3.5 shrink-0',
                plan.highlighted ? 'text-marker' : 'text-muted-foreground',
              )}
              strokeWidth={2.25}
            />
            {point}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        <a
          href={plan.href}
          aria-label={`${plan.cta} (${plan.name})`}
          className={cn(
            'flex h-11 w-full items-center justify-center border font-mono text-[13px] font-semibold uppercase transition-[color,background-color,border-color,scale] duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            plan.available
              ? 'border-marker bg-marker text-marker-ink hover:border-marker-hover hover:bg-marker-hover'
              : 'border-foreground text-foreground hover:bg-foreground hover:text-background',
          )}
        >
          {plan.cta}
        </a>
        {!plan.available ? (
          <p className="mt-2 text-center font-mono text-2xs text-muted-foreground">
            {plan.availabilityNote}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function Pricing() {
  const { lang, t } = useLang()
  const p = t.pricing
  const plans: Plan[] = [
    {
      ...p.plans.free,
      availabilityNote: p.availabilityShort,
      href: LINKS.app,
      storage: p.storageLocal,
      cloud: false,
      highlighted: false,
    },
    {
      ...p.plans.licence,
      availabilityNote: p.availabilityShort,
      href: notify(lang, 'licence'),
      storage: p.storageLocal,
      cloud: false,
      highlighted: true,
    },
    {
      ...p.plans.cloud,
      availabilityNote: p.availabilityShort,
      href: notify(lang, 'cloud'),
      storage: p.storageCloud,
      cloud: true,
      highlighted: false,
    },
  ]

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 border-b border-border/60 bg-background px-5 py-20 md:px-10 md:py-28"
    >
      {/* La seule section de la page qui n'était pas bornée. Le Hero, les
          fonctionnalités et la démo tiennent tous dans `max-w-7xl` ; les tarifs
          s'étalaient sur toute la fenêtre, ce qui donnait au comparatif quatre
          colonnes de 400 px pour y écrire « Non » et éloignait chaque valeur de
          son intitulé de la largeur d'une carte. */}
      <div className="mx-auto max-w-7xl">
        <SectionHeading id="pricing-title">{p.title}</SectionHeading>
        <p className="mx-auto mt-6 max-w-[65ch] text-center text-[15px] leading-6 text-muted-foreground">
          {p.sub}
        </p>
        <CostCompare />

        <div className="mt-12 grid items-stretch gap-4 md:grid-cols-3">
          <div className="max-md:order-2">
            <PlanCard plan={plans[0]} />
          </div>
          <div className="max-md:order-1">
            <PlanCard plan={plans[1]} />
          </div>
          <div className="max-md:order-3">
            <PlanCard plan={plans[2]} />
          </div>
        </div>

        <p className="mt-4 text-xs leading-4 text-muted-foreground">
          {p.currencyNote} {p.availability}
        </p>

        <div className="mt-14">
          {/* Sous 600px le tableau déborde et la colonne Licence — la seule qui
              compte — sort de l'écran sans rien qui le dise. */}
          <div className="flex items-baseline justify-between gap-4">
            <SpecLabel id="compare-label">{p.compareLabel}</SpecLabel>
            <span aria-hidden className="text-2xs text-muted-foreground md:hidden">
              {p.compareHint} →
            </span>
          </div>
          {/* Une zone défilante doit être atteignable au clavier : sans tabindex,
              un utilisateur sans souris ne peut pas révéler les colonnes de
              droite du comparatif sur un écran étroit. */}
          <div
            tabIndex={0}
            role="group"
            aria-labelledby="compare-label"
            className="mt-4 max-w-5xl overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* Plus étroit que les cartes, et aligné à gauche : les cartes sont
                la décision, ce tableau en est le détail, et une pleine largeur
                lui donnait le même poids qu'elles. Il ne peut de toute façon
                pas s'aligner sur elles — sa colonne d'intitulés décale ses
                trois colonnes d'une carte entière.

                L'intitulé pèse plus qu'une valeur : « Reprendre sur une autre
                machine » fait quatre mots, « Inclus » en fait un. Quatre quarts
                donnaient la même largeur aux deux et posaient chaque réponse à
                plus de quatre cents pixels de sa question — c'est cette
                distance, pas la hauteur des lignes, qui faisait perdre la
                ligne à l'œil. */}
            <table className="w-full min-w-[600px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[31%]" />
                <col className="w-[23%]" />
                <col className="w-[23%]" />
                <col className="w-[23%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-border/60">
                  <th scope="col" />
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      scope="col"
                      /* La teinte de la colonne recommandée commence à son
                         en-tête : posée sur les seules cellules de corps, la
                         bande se lisait détachée du nom qu'elle désigne. */
                      className={cn(
                        'px-4 pt-1 pb-3 text-left',
                        plan.highlighted && 'bg-marker-soft/50',
                      )}
                    >
                      {/* Le même traitement que sur la carte : ce sont les
                          trois mêmes offres, et deux typographies pour un seul
                          nom en faisaient deux listes à rapprocher de tête. */}
                      <SpecLabel className={cn(plan.highlighted && 'text-foreground')}>
                        {plan.name}
                      </SpecLabel>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-b-0">
                    <th scope="row" className="py-3.5 pr-6 text-left text-sm font-medium">
                      {row.label}
                    </th>
                    {row.values.map((value, column) => (
                      <td
                        key={column}
                        className={cn(
                          'px-4 py-3.5 text-sm text-muted-foreground',
                          column === 1 && 'bg-marker-soft/50 text-foreground',
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Le comparatif décrit l'offre à l'ouverture. Le Gratuit, lui, est
              disponible aujourd'hui et sans restriction : sans cette ligne la
              page décourage la seule action qu'elle sait conclure. */}
          <p className="mt-3 text-xs leading-4 text-muted-foreground">{p.compareNote}</p>
        </div>
      </div>
    </section>
  )
}
