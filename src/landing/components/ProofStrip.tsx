import { useLang } from '../i18n'

/*
 * Les trois nombres qui vendent, en très grand tabulaire, séparés par des
 * filets pleine hauteur — une ligne de tableau de spécification.
 */
export function ProofStrip() {
  const { t } = useLang()
  return (
    <section aria-label="Chiffres clés" className="border-b border-border/60">
      <dl className="grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-border/60">
        {t.proof.items.map((item, index) => (
          <div
            key={item.value}
            className={
              'flex flex-col px-5 py-10 md:px-10 md:py-14' +
              (index > 0 ? ' border-t border-border/60 md:border-t-0' : '')
            }
          >
            <dd className="order-1 text-4xl font-extrabold tracking-tight tabular-nums md:text-5xl">
              {item.value}
            </dd>
            <dt className="order-2 mt-3 max-w-[28ch] text-sm leading-5 text-muted-foreground">
              {item.label}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  )
}
