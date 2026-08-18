import { FileCheck2, Images, ScanLine } from 'lucide-react'
import { useLang } from '../i18n'

/* Dans l’ordre des items : le jeu (dix images), la taille (le scan), le fichier. */
const ICONS = [Images, ScanLine, FileCheck2]

export function ProofStrip() {
  const { t } = useLang()

  return (
    <section
      aria-labelledby="proof-title"
      className="grid border-b border-border/60 bg-stage lg:min-h-[620px] lg:grid-cols-2"
    >
      <div className="radial-grid relative overflow-hidden border-b border-border/60 px-5 py-20 lg:border-r lg:border-b-0 lg:px-14 lg:py-24">
        <div className="relative z-10 max-w-xl">
          <h2
            id="proof-title"
            className="font-display text-[clamp(2.7rem,4.6vw,4.2rem)] leading-[1.05] font-normal tracking-[-0.024em] text-balance"
          >
            {t.proof.title}
          </h2>
          <p className="mt-7 max-w-[55ch] text-base leading-7 text-muted-foreground">
            {t.proof.body}
          </p>
        </div>
      </div>

      <dl className="divide-y divide-border/60">
        {t.proof.items.map((item, index) => {
          const Icon = ICONS[index]
          return (
            <div
              key={item.value}
              className="flex min-h-44 flex-col justify-center px-5 py-9 md:px-14"
            >
              <Icon aria-hidden className="mb-5 size-6 text-marker" strokeWidth={1.5} />
              <dt className="order-2 mt-3 max-w-[42ch] text-sm leading-6 text-muted-foreground">
                {item.label}
              </dt>
              <dd className="order-1 font-mono text-[clamp(1.8rem,3vw,2.7rem)] leading-none tracking-[-0.025em]">
                {item.value}
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
