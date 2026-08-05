import { useLang } from '../i18n'

export function ProofStrip() {
  const { t } = useLang()
  return (
    <section aria-label="Chiffres clés" className="border-y border-border">
      <dl className="mx-auto grid max-w-6xl grid-cols-1 gap-y-10 px-5 py-14 md:grid-cols-3 md:gap-y-0 md:divide-x md:divide-border">
        {t.proof.items.map((item) => (
          <div key={item.value} className="flex flex-col md:px-10 md:first:pl-0 md:last:pr-0">
            <dt className="order-2 mt-3 text-sm leading-5 text-muted-foreground">{item.label}</dt>
            <dd className="order-1 text-3xl font-bold tracking-tight tabular-nums md:text-4xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
