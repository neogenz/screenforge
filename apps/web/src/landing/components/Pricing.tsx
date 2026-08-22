import { cn } from '@/lib/utils'
import { Check, Cloud, HardDrive } from 'lucide-react'
import { useLang } from '../i18n'
import { offerHref } from '../links'
import { CtaGhost, CtaPrimary } from './cta'
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
 * Deux cartes, deux modèles autonomes : Local gratuit et Cloud payant.
 *
 * Le citron va au bouton du plan mis en avant, et à lui seul. Il allait
 * autrefois à tout bouton « disponible », ce qui, les deux offres l'étant,
 * posait deux aplats côte à côte — soit zéro action primaire. La page apprend
 * à l'œil pendant trois mille pixels que citron = « c'est ici qu'on clique » ;
 * elle doit désigner une seule cible par rangée. La recommandation reste dite
 * aussi par la carte — fond, anneau, badge — qui sont des états, pas des
 * actions.
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
      {/* Hauteur réservée pour le badge afin que les prix partagent leur ligne. */}
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
      {/* Ligne réservée : seul le Cloud porte une note, mais les séparateurs
          des deux cartes doivent rester alignés. */}
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

      {/* Chaque carte dit directement ce qu'elle achète. */}
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
        {/* Le rang du plan, pas sa disponibilité : deux boutons citron côte à
            côte, c'est zéro bouton primaire. Local est le primaire parce que
            c'est ce que la page demande d'ouvrir ; Cloud se vend depuis
            l'éditeur. `FinalCta` porte déjà exactement ce couple, et c'est là
            qu'il faut lire la référence de rang. `available` ne décide plus
            que de la note de disponibilité. */}
        {plan.highlighted ? (
          <CtaPrimary href={plan.href} ariaLabel={`${plan.cta} (${plan.name})`} className="w-full">
            {plan.cta}
          </CtaPrimary>
        ) : (
          <CtaGhost href={plan.href} ariaLabel={`${plan.cta} (${plan.name})`} className="w-full">
            {plan.cta}
          </CtaGhost>
        )}
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
      ...p.plans.local,
      availabilityNote: p.availabilityShort,
      href: offerHref(lang, 'local'),
      storage: p.storageLocal,
      cloud: false,
      highlighted: true,
    },
    {
      ...p.plans.cloud,
      availabilityNote: p.availabilityShort,
      href: offerHref(lang, 'cloud'),
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
        <div className="mx-auto mt-12 grid max-w-5xl items-stretch gap-4 md:grid-cols-2">
          <div>
            <PlanCard plan={plans[0]} />
          </div>
          <div>
            <PlanCard plan={plans[1]} />
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-5xl text-xs leading-4 text-muted-foreground">
          {p.localNote}
        </p>
        <p className="mx-auto mt-2 max-w-5xl text-xs leading-4 text-muted-foreground">
          {p.currencyNote} {p.availability}
        </p>

        <div className="mt-14">
          {/* Sous 600px le tableau défile et l'annonce avant le geste. */}
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
                deux colonnes d'une carte entière.

                L'intitulé pèse plus qu'une valeur : « Reprendre sur une autre
                machine » fait quatre mots, « Inclus » en fait un. Quatre quarts
                donnaient la même largeur aux deux et posaient chaque réponse à
                plus de quatre cents pixels de sa question — c'est cette
                distance, pas la hauteur des lignes, qui faisait perdre la
                ligne à l'œil. */}
            <table className="w-full min-w-[560px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[30%]" />
                <col className="w-[30%]" />
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
                         bande se lisait détachée du nom qu'elle désigne.

                         Le retrait haut est celui d'une bande, pas celui d'une
                         ligne d'en-tête : à `pt-1` le nom démarrait
                         à 4 px du bord teinté quand il en avait 13 dessous et 12
                         dans chaque cellule du corps. Une épaule plus courte que
                         tous les autres retraits se lit comme un débordement, et
                         c'est le haut de la colonne qui décide — c'est là que
                         l'œil entre. */
                      className={cn(
                        'px-4 pt-4 pb-3 text-left',
                        plan.highlighted && 'bg-marker-soft/50',
                      )}
                    >
                      {/* Le même traitement que sur la carte : ce sont les
                          deux mêmes offres, et deux typographies pour un seul
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
                          column === 0 && 'bg-marker-soft/50 text-foreground',
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
          <p className="mt-3 text-xs leading-4 text-muted-foreground">{p.compareNote}</p>
        </div>
      </div>
    </section>
  )
}
