import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { useLang } from '../i18n'
import { LINKS } from '../links'

type Tier = {
  name: string
  price: string
  period: string
  badge?: string
  features: string[]
  cta: string
}

function PriceCard({
  tier,
  href,
  highlighted = false,
}: {
  tier: Tier
  href: string
  highlighted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-lg p-7',
        highlighted
          ? 'bg-card shadow-md ring-1 ring-foreground/10'
          : 'bg-background ring-1 ring-border',
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{tier.name}</h3>
        {tier.badge ? (
          <span className="rounded-xs bg-secondary px-2 py-0.5 text-2xs font-medium text-secondary-foreground">
            {tier.badge}
          </span>
        ) : null}
      </div>
      <p className="mt-5 flex items-baseline gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums">{tier.price}</span>
        {tier.period ? <span className="text-sm text-muted-foreground">{tier.period}</span> : null}
      </p>
      <ul className="mt-6 flex flex-col gap-2.5 text-sm text-muted-foreground">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>
      <a
        href={href}
        className={cn(
          'mt-8 inline-flex h-10 items-center justify-center rounded-sm text-sm font-medium transition-colors duration-150',
          highlighted
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'shadow-[inset_0_0_0_1px_var(--color-input)] hover:bg-secondary',
        )}
      >
        {tier.cta}
      </a>
    </div>
  )
}

export function Pricing() {
  const { t } = useLang()
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-5 py-24 md:py-32">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance md:text-4xl">
            {t.pricing.title}
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-muted-foreground">{t.pricing.sub}</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <div className="max-md:order-2">
            <PriceCard tier={t.pricing.free} href={LINKS.app} />
          </div>
          <div className="max-md:order-3">
            <PriceCard tier={t.pricing.monthly} href={LINKS.checkoutMonthly} />
          </div>
          <div className="max-md:order-1">
            <PriceCard highlighted tier={t.pricing.lifetime} href={LINKS.checkoutLifetime} />
          </div>
        </div>
        <p className="mt-8 text-xs leading-4 text-muted-foreground">
          {t.pricing.currencyNote} {t.pricing.waitlistNote}
        </p>
      </div>
    </section>
  )
}
