import { cn } from '@/lib/utils'
import { useLang } from '../i18n'
import { LINKS } from '../links'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { SpecLabel } from './SpecLabel'

type Plan = {
  name: string
  price: string
  period: string
  tagline: string
  badge?: string
  cta: string
  href: string
  highlighted: boolean
}

/*
 * Le pricing en deux temps : trois cartes de décision (prix, différenciant,
 * CTA immédiat — la Lifetime ceinte d'un filet citron), puis le tableau de
 * spécification pour le détail. La carte porte la vente, le tableau prouve.
 */
function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-lg p-6 transition-[transform,box-shadow] duration-200 ease-out',
        plan.highlighted
          ? 'bg-marker-soft shadow-md ring-1 ring-marker-line hover:-translate-y-0.5 hover:shadow-lg'
          : 'bg-background ring-1 ring-border hover:-translate-y-0.5 hover:shadow-md',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <SpecLabel>{plan.name}</SpecLabel>
        {plan.badge ? (
          <span className="rounded-xs bg-marker px-2 py-0.5 text-2xs font-semibold text-marker-ink normal-case">
            {plan.badge}
          </span>
        ) : null}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight tabular-nums">{plan.price}</span>
        {plan.period ? <span className="text-sm text-muted-foreground">{plan.period}</span> : null}
      </p>
      <p className="mt-2 min-h-5 text-xs leading-4 text-muted-foreground">{plan.tagline}</p>
      <a
        href={plan.href}
        className={cn(
          'mt-6 inline-flex h-10 items-center justify-center rounded-sm text-sm font-medium transition-[background-color,transform] duration-150 active:scale-[0.96]',
          plan.highlighted
            ? 'bg-marker text-marker-ink hover:bg-marker-hover'
            : 'shadow-[inset_0_0_0_1px_var(--color-input)] hover:bg-secondary',
        )}
      >
        {plan.cta}
      </a>
    </div>
  )
}

export function Pricing() {
  const { t } = useLang()
  const plans: Plan[] = [
    { ...t.pricing.plans.free, href: LINKS.app, highlighted: false },
    { ...t.pricing.plans.monthly, href: LINKS.checkoutMonthly, highlighted: false },
    { ...t.pricing.plans.lifetime, href: LINKS.checkoutLifetime, highlighted: true },
  ]

  return (
    <section
      id="pricing"
      className="scroll-mt-16 border-b border-border/60 bg-background px-5 py-20 md:px-10 md:py-28"
    >
      <SectionHeading index="03" title={t.spec.pricing} />
      <div className="mt-14 max-w-2xl">
        <h2 className="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
          {t.pricing.title}
        </h2>
        <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{t.pricing.sub}</p>
      </div>

      <Reveal delay={80}>
        <div className="mt-14 grid items-stretch gap-4 md:grid-cols-3">
          <div className="max-md:order-2">
            <PlanCard plan={plans[0]} />
          </div>
          <div className="max-md:order-3">
            <PlanCard plan={plans[1]} />
          </div>
          <div className="max-md:order-1">
            <PlanCard plan={plans[2]} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-16">
          <SpecLabel>{t.pricing.compareLabel}</SpecLabel>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-border/60">
                  <th scope="col" className="w-1/4" />
                  {plans.map((plan) => (
                    <th
                      key={plan.name}
                      scope="col"
                      className={cn(
                        'px-4 pb-3 text-left text-xs font-medium text-muted-foreground',
                        plan.highlighted && 'text-foreground',
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.pricing.rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-b-0">
                    <th scope="row" className="py-3.5 pr-4 text-left text-sm font-medium">
                      {row.label}
                    </th>
                    {row.values.map((value, column) => (
                      <td
                        key={column}
                        className={cn(
                          'px-4 py-3.5 text-sm text-muted-foreground',
                          column === 2 && 'bg-marker-soft/50 text-foreground',
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
        </div>
      </Reveal>

      <p className="mt-8 text-xs leading-4 text-muted-foreground">
        {t.pricing.currencyNote} {t.pricing.waitlistNote}
      </p>
    </section>
  )
}
