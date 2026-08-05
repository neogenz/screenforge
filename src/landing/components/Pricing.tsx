import { cn } from '@/lib/utils'
import { useLang } from '../i18n'
import { LINKS } from '../links'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { SpecLabel } from './SpecLabel'

/*
 * Le pricing comme tableau de spécification : rangées de caractéristiques,
 * colonnes d'offres, la colonne Lifetime sur un palier plus clair. Aucune
 * carte — la grille de cartes identiques est le marqueur SaaS générique.
 */
export function Pricing() {
  const { t } = useLang()
  const plans = [
    { ...t.pricing.plans.free, href: LINKS.app, highlighted: false },
    { ...t.pricing.plans.monthly, href: LINKS.checkoutMonthly, highlighted: false },
    { ...t.pricing.plans.lifetime, href: LINKS.checkoutLifetime, highlighted: true },
  ] as const

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
        <div className="mt-14 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className="w-1/4" />
                {plans.map((plan) => (
                  <th
                    key={plan.name}
                    scope="col"
                    className={cn(
                      'px-4 pb-6 text-left align-bottom',
                      plan.highlighted && 'bg-marker-soft',
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <SpecLabel>{plan.name}</SpecLabel>
                      {'badge' in plan && plan.badge ? (
                        <span className="rounded-xs bg-marker px-2 py-0.5 text-2xs font-semibold text-marker-ink normal-case">
                          {plan.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight tabular-nums">
                        {plan.price}
                      </span>
                      {plan.period ? (
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      ) : null}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.pricing.rows.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <th scope="row" className="py-4 pr-4 text-left text-sm font-medium">
                    {row.label}
                  </th>
                  {row.values.map((value, column) => (
                    <td
                      key={column}
                      className={cn(
                        'px-4 py-4 text-sm text-muted-foreground',
                        column === 2 && 'bg-marker-soft text-foreground',
                      )}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-border/60">
                <td />
                {plans.map((plan) => (
                  <td
                    key={plan.name}
                    className={cn('px-4 py-6', plan.highlighted && 'bg-marker-soft')}
                  >
                    <a
                      href={plan.href}
                      className={cn(
                        'inline-flex h-10 w-full items-center justify-center rounded-sm text-sm font-medium transition-colors duration-150',
                        plan.highlighted
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                          : 'shadow-[inset_0_0_0_1px_var(--color-input)] hover:bg-secondary',
                      )}
                    >
                      {plan.cta}
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Reveal>
      <p className="mt-8 text-xs leading-4 text-muted-foreground">
        {t.pricing.currencyNote} {t.pricing.waitlistNote}
      </p>
    </section>
  )
}
